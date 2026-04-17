import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: Request) {
  await requireAdmin()

  const { searchParams } = new URL(request.url)
  const parentId = searchParams.get('parent_id')

  let folders

  if (parentId) {
    // Subcarpetas de una carpeta específica
    folders = await sql`
      SELECT f.*, u.name as uploader_name,
        (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count
      FROM folders f
      LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.parent_id = ${Number(parentId)}
      ORDER BY f.name ASC
    `
  } else {
    // Carpetas raíz
    folders = await sql`
      SELECT f.*, u.name as uploader_name,
        (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count
      FROM folders f
      LEFT JOIN users u ON u.id = f.uploaded_by
      WHERE f.parent_id IS NULL
      ORDER BY f.created_at DESC
    `
  }

  return NextResponse.json({ folders })
}