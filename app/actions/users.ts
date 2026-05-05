'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { requireAdmin, getSession } from '@/lib/auth'

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
  const name     = formData.get('name')     as string
  const email    = formData.get('email')    as string
  const password = formData.get('password') as string
  const role     = (formData.get('role') as string) || 'user'

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
  // Ahora devuelve también can_manage para cada usuario
  return sql`
    SELECT user_id, can_manage
    FROM folder_permissions
    WHERE folder_id = ${folderId}
  `
}

// Actualizado: permite asignar can_manage por usuario
export async function setFolderPermissionsAction(
  folderId: number,
  permissions: { userId: number; canManage: boolean }[]
) {
  await requireAdmin()

  await sql`DELETE FROM folder_permissions WHERE folder_id = ${folderId}`

  for (const { userId, canManage } of permissions) {
    await sql`
      INSERT INTO folder_permissions (folder_id, user_id, can_manage)
      VALUES (${folderId}, ${userId}, ${canManage})
      ON CONFLICT DO NOTHING
    `
  }

  revalidatePath('/admin')
  revalidatePath('/drive')
  return { success: true }
}

// ── Carpetas raíz que el usuario puede ver ──
export async function getUserFolders(userId: number) {
  return sql`
    SELECT f.*,
      (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count,
      (SELECT COUNT(*) FROM folders sub WHERE sub.parent_id = f.id) as subfolder_count,
      fp.can_manage
    FROM folders f
    JOIN folder_permissions fp ON fp.folder_id = f.id
    WHERE fp.user_id = ${userId}
      AND f.parent_id IS NULL
    ORDER BY f.name ASC
  `
}

// ── Subcarpetas accesibles por ancestro ──
export async function getUserSubfolders(folderId: number, userId: number) {
  const hasAccess = await sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM folders WHERE id = ${folderId}
      UNION ALL
      SELECT f.id, f.parent_id FROM folders f
      JOIN ancestors a ON a.parent_id = f.id
    )
    SELECT fp.can_manage FROM folder_permissions fp
    JOIN ancestors a ON a.id = fp.folder_id
    WHERE fp.user_id = ${userId}
    LIMIT 1
  `
  if (!hasAccess.length) return []

  const canManage = hasAccess[0].can_manage as boolean

  return sql`
    SELECT f.*,
      (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count,
      (SELECT COUNT(*) FROM folders sub WHERE sub.parent_id = f.id) as subfolder_count,
      ${canManage} as can_manage
    FROM folders f
    WHERE f.parent_id = ${folderId}
    ORDER BY f.name ASC
  `
}

// ── Archivos de una carpeta ──
export async function getFolderFiles(folderId: number, userId: number, isAdmin: boolean) {
  if (isAdmin) {
    return sql`SELECT * FROM files WHERE folder_id = ${folderId} ORDER BY name ASC`
  }

  const hasAccess = await sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM folders WHERE id = ${folderId}
      UNION ALL
      SELECT f.id, f.parent_id FROM folders f
      JOIN ancestors a ON a.parent_id = f.id
    )
    SELECT 1 FROM folder_permissions fp
    JOIN ancestors a ON a.id = fp.folder_id
    WHERE fp.user_id = ${userId}
    LIMIT 1
  `
  if (!hasAccess.length) return []

  return sql`SELECT * FROM files WHERE folder_id = ${folderId} ORDER BY name ASC`
}

// ── Verifica si el usuario puede gestionar una carpeta ──
export async function checkCanManage(folderId: number): Promise<boolean> {
  const user = await getSession()
  if (!user) return false
  if (user.role === 'admin') return true

  const result = await sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM folders WHERE id = ${folderId}
      UNION ALL
      SELECT f.id, f.parent_id FROM folders f
      JOIN ancestors a ON a.parent_id = f.id
    )
    SELECT 1 FROM folder_permissions fp
    JOIN ancestors a ON a.id = fp.folder_id
    WHERE fp.user_id = ${user.id} AND fp.can_manage = TRUE
    LIMIT 1
  `
  return result.length > 0
}