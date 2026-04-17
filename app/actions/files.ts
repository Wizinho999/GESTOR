'use server'

import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'
import sql from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function createFolderAction(formData: FormData) {
  const admin = await requireAdmin()
  const name = formData.get('name') as string
  const parentId = formData.get('parent_id') ? Number(formData.get('parent_id')) : null

  if (!name?.trim()) return { error: 'Nombre requerido' }

  await sql`
    INSERT INTO folders (name, parent_id, uploaded_by)
    VALUES (${name.trim()}, ${parentId}, ${admin.id})
  `
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function uploadFileAction(formData: FormData) {
  const admin = await requireAdmin()
  const file = formData.get('file') as File
  const folderId = formData.get('folder_id') ? Number(formData.get('folder_id')) : null

  if (!file || file.size === 0) return { error: 'Archivo requerido' }
  if (!file.name.toLowerCase().endsWith('.pdf')) return { error: 'Solo se permiten archivos PDF' }

  const blob = await put(`pdfs/${Date.now()}-${file.name}`, file, {
    access: 'private',
    contentType: 'application/pdf',
  })

  await sql`
    INSERT INTO files (name, blob_url, folder_id, uploaded_by, size_bytes)
    VALUES (${file.name}, ${blob.pathname}, ${folderId}, ${admin.id}, ${file.size})
  `
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// NUEVA: sube una carpeta completa preservando subcarpetas
// Recibe archivos con sus rutas relativas (webkitRelativePath)
// paths: ["Carpeta/Sub/archivo.pdf", "Carpeta/otro.pdf", ...]
// ─────────────────────────────────────────────────────────────
export async function uploadFolderAction(formData: FormData) {
  const admin = await requireAdmin()

  // Extraer todos los archivos y sus rutas
  const entries: { file: File; path: string }[] = []
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('file_') && value instanceof File) {
      const index = key.replace('file_', '')
      const path  = formData.get(`path_${index}`) as string
      if (path && value.size > 0 && value.name.toLowerCase().endsWith('.pdf')) {
        entries.push({ file: value, path })
      }
    }
  }

  if (entries.length === 0) return { error: 'No se encontraron PDFs en la carpeta' }

  // Cache de carpetas ya creadas: "nombre/completo/ruta" → id
  const folderCache = new Map<string, number>()

  // Función recursiva: dado un path como "Root/Sub/archivo.pdf",
  // crea las carpetas necesarias y devuelve el id de la carpeta padre del archivo
  async function ensureFolder(segments: string[]): Promise<number | null> {
    if (segments.length === 0) return null

    let parentId: number | null = null

    for (let i = 0; i < segments.length; i++) {
      const cacheKey = segments.slice(0, i + 1).join('/')

      if (folderCache.has(cacheKey)) {
        parentId = folderCache.get(cacheKey) as number
        continue
      }

      // Buscar si ya existe en DB bajo ese padre
      const existing = parentId !== null
        ? await sql`
            SELECT id FROM folders
            WHERE name = ${segments[i]} AND parent_id = ${parentId}
            LIMIT 1
          `
        : await sql`
            SELECT id FROM folders
            WHERE name = ${segments[i]} AND parent_id IS NULL
            LIMIT 1
          `

      let folderId: number

      if (existing.length > 0) {
        folderId = existing[0].id as number
      } else {
        const created = parentId !== null
          ? await sql`
              INSERT INTO folders (name, parent_id, uploaded_by)
              VALUES (${segments[i]}, ${parentId}, ${admin.id})
              RETURNING id
            `
          : await sql`
              INSERT INTO folders (name, parent_id, uploaded_by)
              VALUES (${segments[i]}, NULL, ${admin.id})
              RETURNING id
            `
        folderId = created[0].id as number
      }

      folderCache.set(cacheKey, folderId)
      parentId = folderId
    }

    return parentId
  }

  let uploaded = 0
  let skipped  = 0

  for (const { file, path } of entries) {
    // path ejemplo: "AMAROK-2022/Enero/factura.pdf"
    const parts     = path.split('/')
    const fileName  = parts[parts.length - 1]
    const dirParts  = parts.slice(0, -1) // carpetas sin el nombre del archivo

    try {
      const folderId = await ensureFolder(dirParts)

      const blob = await put(`pdfs/${Date.now()}-${fileName}`, file, {
        access:      'private',
        contentType: 'application/pdf',
      })

      await sql`
        INSERT INTO files (name, blob_url, folder_id, uploaded_by, size_bytes)
        VALUES (${fileName}, ${blob.pathname}, ${folderId}, ${admin.id}, ${file.size})
      `
      uploaded++
    } catch {
      skipped++
    }
  }

  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true, uploaded, skipped }
}

export async function deleteFolderAction(folderId: number) {
  await requireAdmin()
  await sql`DELETE FROM folders WHERE id = ${folderId}`
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function deleteFileAction(fileId: number) {
  await requireAdmin()
  await sql`DELETE FROM files WHERE id = ${fileId}`
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function getFoldersAdmin() {
  await requireAdmin()
  const folders = await sql`
    SELECT f.*, u.name as uploader_name,
      (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count
    FROM folders f
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE f.parent_id IS NULL
    ORDER BY f.created_at DESC
  `
  return folders
}

export async function getFilesAdmin(folderId?: number) {
  await requireAdmin()
  if (folderId) {
    return sql`
      SELECT fi.*, u.name as uploader_name
      FROM files fi
      LEFT JOIN users u ON u.id = fi.uploaded_by
      WHERE fi.folder_id = ${folderId}
      ORDER BY fi.created_at DESC
    `
  }
  return sql`
    SELECT fi.*, u.name as uploader_name, fo.name as folder_name
    FROM files fi
    LEFT JOIN users u ON u.id = fi.uploaded_by
    LEFT JOIN folders fo ON fo.id = fi.folder_id
    ORDER BY fi.created_at DESC
  `
}