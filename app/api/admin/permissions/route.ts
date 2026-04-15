import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import sql from '@/lib/db'

// GET: fetch all folder_ids accessible by a user
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = Number(request.nextUrl.searchParams.get('user_id'))
  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const rows = await sql`
    SELECT folder_id FROM folder_permissions WHERE user_id = ${userId}
  `
  return NextResponse.json({ folder_ids: rows.map((r: any) => r.folder_id) })
}

// POST: replace all folder permissions for a user
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user_id, folder_ids } = await request.json() as { user_id: number; folder_ids: number[] }

  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  // Remove all existing permissions for this user
  await sql`DELETE FROM folder_permissions WHERE user_id = ${user_id}`

  // Add new ones
  for (const folderId of folder_ids) {
    await sql`
      INSERT INTO folder_permissions (folder_id, user_id)
      VALUES (${folderId}, ${user_id})
      ON CONFLICT DO NOTHING
    `
  }

  return NextResponse.json({ success: true })
}
