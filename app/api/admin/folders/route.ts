import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const folders = await sql`
    SELECT f.*, u.name as uploader_name,
      (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count
    FROM folders f
    LEFT JOIN users u ON u.id = f.uploaded_by
    WHERE f.parent_id IS NULL
    ORDER BY f.created_at DESC
  `
  return NextResponse.json({ folders })
}
