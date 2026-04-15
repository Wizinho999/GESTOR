import { cookies } from 'next/headers'
import sql from './db'

export interface SessionUser {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (!sessionId) return null

  const rows = await sql`
    SELECT u.id, u.name, u.email, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId}
      AND s.expires_at > NOW()
  `
  if (!rows.length) return null
  return rows[0] as SessionUser
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession()
  if (user.role !== 'admin') throw new Error('Forbidden')
  return user
}
