import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import sql from '@/lib/db'

// GET: permisos de un usuario con can_manage
export async function GET(request: NextRequest) {
  try { await requireAdmin() } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = Number(request.nextUrl.searchParams.get('user_id'))
  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const rows = await sql`
    SELECT folder_id, can_manage
    FROM folder_permissions
    WHERE user_id = ${userId}
  `

  return NextResponse.json({ permissions: rows })
}

// POST: reemplaza todos los permisos del usuario
export async function POST(request: NextRequest) {
  try { await requireAdmin() } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user_id, permissions } = await request.json() as {
    user_id: number
    permissions: { folder_id: number; can_manage: boolean }[]
  }

  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  await sql`DELETE FROM folder_permissions WHERE user_id = ${user_id}`

  for (const { folder_id, can_manage } of permissions) {
    await sql`
      INSERT INTO folder_permissions (folder_id, user_id, can_manage)
      VALUES (${folder_id}, ${user_id}, ${can_manage})
      ON CONFLICT DO NOTHING
    `
  }

  return NextResponse.json({ success: true })
}