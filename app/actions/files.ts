'use server'

import { revalidatePath } from 'next/cache'
import sql from '@/lib/db'
import { getSession, requireAdmin } from '@/lib/auth'

// ── Helper: verifica si el usuario puede gestionar una carpeta ──
// Retorna true si es admin global O si tiene can_manage=true en esa carpeta
async function canManageFolder(userId: number, folderId: number | null, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true
  if (!folderId) return false

  // Buscar si tiene permiso de gestión sobre esta carpeta o algún ancestro
  const result = await sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM folders WHERE id = ${folderId}
      UNION ALL
      SELECT f.id, f.parent_id FROM folders f
      JOIN ancestors a ON a.parent_id = f.id
    )
    SELECT 1 FROM folder_permissions fp
    JOIN ancestors a ON a.id = fp.folder_id
    WHERE fp.user_id = ${userId} AND fp.can_manage = TRUE
    LIMIT 1
  `
  return result.length > 0
}

// ─────────────────────────────────────────────────────────────
// CARPETAS
// ─────────────────────────────────────────────────────────────

export async function createFolderAction(formData: FormData) {
  const user     = await getSession()
  if (!user) return { error: 'No autenticado' }
  const isAdmin  = user.role === 'admin'
  const parentId = formData.get('parent_id') ? Number(formData.get('parent_id')) : null
  const name     = formData.get('name') as string

  if (!name?.trim()) return { error: 'Nombre requerido' }

  // Verificar permiso
  if (!isAdmin) {
    const allowed = await canManageFolder(user.id, parentId, false)
    if (!allowed) return { error: 'Sin permisos para crear carpetas aquí' }
  }

  await sql`
    INSERT INTO folders (name, parent_id, uploaded_by)
    VALUES (${name.trim()}, ${parentId}, ${user.id})
  `
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function renameFolderAction(folderId: number, newName: string) {
  const user    = await getSession()
  if (!user) return { error: 'No autenticado' }
  const isAdmin = user.role === 'admin'

  if (!newName.trim()) return { error: 'Nombre requerido' }

  // Verificar permiso
  const allowed = await canManageFolder(user.id, folderId, isAdmin)
  if (!allowed) return { error: 'Sin permisos para renombrar esta carpeta' }

  await sql`UPDATE folders SET name = ${newName.trim()} WHERE id = ${folderId}`
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function deleteFolderAction(folderId: number) {
  const user    = await getSession()
  if (!user) return { error: 'No autenticado' }
  const isAdmin = user.role === 'admin'

  const allowed = await canManageFolder(user.id, folderId, isAdmin)
  if (!allowed) return { error: 'Sin permisos para eliminar esta carpeta' }

  await sql`DELETE FROM folders WHERE id = ${folderId}`
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// ARCHIVOS
// ─────────────────────────────────────────────────────────────

export async function uploadFileAction(formData: FormData) {
  const user     = await getSession()
  if (!user) return { error: 'No autenticado' }
  const isAdmin  = user.role === 'admin'
  const file     = formData.get('file') as File
  const folderId = formData.get('folder_id') ? Number(formData.get('folder_id')) : null

  if (!file || file.size === 0) return { error: 'Archivo requerido' }
  if (!file.name.toLowerCase().endsWith('.pdf')) return { error: 'Solo se permiten archivos PDF' }

  if (!isAdmin) {
    const allowed = await canManageFolder(user.id, folderId, false)
    if (!allowed) return { error: 'Sin permisos para subir archivos aquí' }
  }

  // Guardar localmente (ajusta la ruta según tu configuración de almacenamiento local)
  const fileName = `${Date.now()}-${file.name}`
  const filePath = `/uploads/${fileName}`

  await sql`
    INSERT INTO files (name, blob_url, folder_id, uploaded_by, size_bytes)
    VALUES (${file.name}, ${filePath}, ${folderId}, ${user.id}, ${file.size})
  `
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function renameFileAction(fileId: number, newName: string) {
  const user    = await getSession()
  if (!user) return { error: 'No autenticado' }
  const isAdmin = user.role === 'admin'

  if (!newName.trim()) return { error: 'Nombre requerido' }
  if (!newName.toLowerCase().endsWith('.pdf')) return { error: 'El nombre debe terminar en .pdf' }

  if (!isAdmin) {
    // Obtener la carpeta del archivo para verificar permiso
    const rows = await sql`SELECT folder_id FROM files WHERE id = ${fileId}`
    if (!rows.length) return { error: 'Archivo no encontrado' }
    const allowed = await canManageFolder(user.id, rows[0].folder_id, false)
    if (!allowed) return { error: 'Sin permisos para renombrar este archivo' }
  }

  await sql`UPDATE files SET name = ${newName.trim()} WHERE id = ${fileId}`
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function deleteFileAction(fileId: number) {
  const user    = await getSession()
  if (!user) return { error: 'No autenticado' }
  const isAdmin = user.role === 'admin'

  if (!isAdmin) {
    const rows = await sql`SELECT folder_id FROM files WHERE id = ${fileId}`
    if (!rows.length) return { error: 'Archivo no encontrado' }
    const allowed = await canManageFolder(user.id, rows[0].folder_id, false)
    if (!allowed) return { error: 'Sin permisos para eliminar este archivo' }
  }

  await sql`DELETE FROM files WHERE id = ${fileId}`
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────

export async function getFoldersAdmin() {
  await requireAdmin()
  return sql`
    SELECT f.*, u.name as uploader_name,
      (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count,
      (SELECT COUNT(*) FROM folders sub WHERE sub.parent_id = f.id) as subfolder_count
    FROM folders f
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE f.parent_id IS NULL
    ORDER BY f.created_at DESC
  `
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

// ── Agregar esto al final de app/actions/files.ts ──

export async function uploadFolderAction(formData: FormData) {
  const session = await getSession()
  if (!session) return { error: 'No autenticado' }
  const user    = session
  const isAdmin = user.role === 'admin'

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

  const folderCache = new Map<string, number>()

  async function ensureFolder(segments: string[]): Promise<number | null> {
    if (segments.length === 0) return null

    let parentId: number | null = null

    for (let i = 0; i < segments.length; i++) {
      const cacheKey = segments.slice(0, i + 1).join('/')
      if (folderCache.has(cacheKey)) {
        parentId = folderCache.get(cacheKey) as number
        continue
      }

      // Verificar permiso en cada nivel si no es admin
      if (!isAdmin && parentId !== null) {
        const allowed = await canManageFolder(user.id, parentId, false)
        if (!allowed) return null
      }

      const existing = parentId !== null
        ? await sql`SELECT id FROM folders WHERE name = ${segments[i]} AND parent_id = ${parentId} LIMIT 1`
        : await sql`SELECT id FROM folders WHERE name = ${segments[i]} AND parent_id IS NULL LIMIT 1`

      let folderId: number

      if (existing.length > 0) {
        folderId = existing[0].id as number
      } else {
        const created = parentId !== null
          ? await sql`INSERT INTO folders (name, parent_id, uploaded_by) VALUES (${segments[i]}, ${parentId}, ${user.id}) RETURNING id`
          : await sql`INSERT INTO folders (name, parent_id, uploaded_by) VALUES (${segments[i]}, NULL, ${user.id}) RETURNING id`
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
    const parts    = path.split('/')
    const fileName = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)

    try {
      const folderId = await ensureFolder(dirParts)
      if (folderId === null) { skipped++; continue }

      const filePath = `/uploads/${Date.now()}-${fileName}`
      await sql`
        INSERT INTO files (name, blob_url, folder_id, uploaded_by, size_bytes)
        VALUES (${fileName}, ${filePath}, ${folderId}, ${user.id}, ${file.size})
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

