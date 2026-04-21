// ⚠ Reemplaza lib/auth.ts
//
// CACHÉ DE SESIÓN: en vez de ir a la DB en cada request,
// guardamos los datos del usuario en una cookie firmada con HMAC.
// La cookie session_data se renueva al hacer login y se borra al logout.
// La cookie session_id sigue existiendo para poder invalidar sesiones
// desde el servidor (ej: al cambiar contraseña o forzar logout).

import { cookies } from 'next/headers'
import { createHmac } from 'crypto'
import sql from './db'

export interface SessionUser {
  id:    number
  name:  string
  email: string
  role:  'admin' | 'user'
}

// ── Firma / verifica los datos de sesión ──────────────────────
const SECRET = process.env.SESSION_SECRET ?? 'samtech-session-secret-changeme'

function sign(payload: SessionUser): string {
  const data = JSON.stringify(payload)
  const sig   = createHmac('sha256', SECRET).update(data).digest('hex')
  return Buffer.from(data).toString('base64') + '.' + sig
}

function verify(token: string): SessionUser | null {
  try {
    const [b64, sig] = token.split('.')
    if (!b64 || !sig) return null
    const data     = Buffer.from(b64, 'base64').toString()
    const expected = createHmac('sha256', SECRET).update(data).digest('hex')
    // Comparación segura contra timing attacks
    if (sig.length !== expected.length) return null
    let diff = 0
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
    if (diff !== 0) return null
    return JSON.parse(data) as SessionUser
  } catch {
    return null
  }
}

// ── Guarda la cookie cacheada (llamar después de crear sesión) ─
export async function setSessionCache(user: SessionUser, expiresAt: Date) {
  const cookieStore = await cookies()
  cookieStore.set('session_data', sign(user), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires:  expiresAt,
    path:     '/',
  })
}

// ── Borra la cookie cacheada (llamar en logout) ────────────────
export async function clearSessionCache() {
  const cookieStore = await cookies()
  cookieStore.delete('session_data')
}

// ── Obtiene la sesión: primero desde la cookie, luego desde DB ─
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()

  // 1. Intentar desde cookie cacheada (sin query a DB)
  const cached = cookieStore.get('session_data')?.value
  if (cached) {
    const user = verify(cached)
    if (user) return user
  }

  // 2. Fallback a DB (primera vez o cookie expirada)
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

  const user = rows[0] as SessionUser

  // Guardar en cookie para próximas requests
  const expRows = await sql`SELECT expires_at FROM sessions WHERE id = ${sessionId}`
  if (expRows.length) {
    await setSessionCache(user, new Date(expRows[0].expires_at as string))
  }

  return user
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