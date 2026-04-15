'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function getAllUsers() {
  await requireAdmin()
  return sql`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY created_at DESC
  `
}

export async function createUserAction(formData: FormData) {
  await requireAdmin()
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = (formData.get('role') as string) || 'user'

  if (!name || !email || !password) return { error: 'Todos los campos son requeridos' }

  const hash = await bcrypt.hash(password, 10)

  try {
    await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (${name.trim()}, ${email.toLowerCase().trim()}, ${hash}, ${role})
    `
    revalidatePath('/admin')
    return { success: true }
  } catch {
    return { error: 'El correo ya está en uso' }
  }
}

export async function deleteUserAction(userId: number) {
  await requireAdmin()
  await sql`DELETE FROM users WHERE id = ${userId} AND role != 'admin'`
  revalidatePath('/admin')
  return { success: true }
}

export async function getFolderPermissions(folderId: number) {
  await requireAdmin()
  return sql`
    SELECT user_id FROM folder_permissions WHERE folder_id = ${folderId}
  `
}

export async function setFolderPermissionsAction(folderId: number, userIds: number[]) {
  await requireAdmin()

  await sql`DELETE FROM folder_permissions WHERE folder_id = ${folderId}`

  if (userIds.length > 0) {
    for (const uid of userIds) {
      await sql`
        INSERT INTO folder_permissions (folder_id, user_id)
        VALUES (${folderId}, ${uid})
        ON CONFLICT DO NOTHING
      `
    }
  }

  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

export async function getUserFolders(userId: number) {
  const folders = await sql`
    SELECT f.*,
      (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count
    FROM folders f
    JOIN folder_permissions fp ON fp.folder_id = f.id
    WHERE fp.user_id = ${userId}
      AND f.parent_id IS NULL
    ORDER BY f.name ASC
  `
  return folders
}

export async function getFolderFiles(folderId: number, userId: number, isAdmin: boolean) {
  if (isAdmin) {
    return sql`
      SELECT * FROM files WHERE folder_id = ${folderId} ORDER BY name ASC
    `
  }
  // check permission
  const perm = await sql`
    SELECT 1 FROM folder_permissions
    WHERE folder_id = ${folderId} AND user_id = ${userId}
  `
  if (!perm.length) return []

  return sql`
    SELECT * FROM files WHERE folder_id = ${folderId} ORDER BY name ASC
  `
}
