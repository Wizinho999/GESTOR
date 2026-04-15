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

  // Store the pathname for private blobs (used with get() to serve)
  await sql`
    INSERT INTO files (name, blob_url, folder_id, uploaded_by, size_bytes)
    VALUES (${file.name}, ${blob.pathname}, ${folderId}, ${admin.id}, ${file.size})
  `
  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
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
