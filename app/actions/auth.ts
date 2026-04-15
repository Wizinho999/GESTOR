'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import sql from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Ingresa tu correo y contraseña' }
  }

  const rows = await sql`
    SELECT id, name, email, role, password_hash
    FROM users
    WHERE email = ${email.toLowerCase().trim()}
  `

  if (!rows.length) {
    return { error: 'Credenciales incorrectas' }
  }

  const user = rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return { error: 'Credenciales incorrectas' }
  }

  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${sessionId}, ${user.id}, ${expiresAt.toISOString()})
  `

  const cookieStore = await cookies()
  cookieStore.set('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  if (user.role === 'admin') {
    redirect('/admin')
  } else {
    redirect('/drive')
  }
}

export async function logoutAction() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (sessionId) {
    await sql`DELETE FROM sessions WHERE id = ${sessionId}`
    cookieStore.delete('session_id')
  }
  redirect('/login')
}

export async function getCurrentUser() {
  return getSession()
}
