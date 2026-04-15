import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await sql`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY created_at DESC
  `
  return NextResponse.json({ users })
}
