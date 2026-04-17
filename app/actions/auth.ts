'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import * as OTPAuth from 'otpauth'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { getSession } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────
// 1. LOGIN — si tiene MFA, devuelve { mfa: true } en vez de
//    redirigir directo, para que la cookie se guarde primero
// ─────────────────────────────────────────────────────────────
export async function loginAction(formData: FormData) {
  const email    = formData.get('email')    as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Ingresa tu correo y contraseña' }
  }

  const rows = await sql`
    SELECT id, name, email, role, password_hash, totp_enabled
    FROM users
    WHERE email = ${email.toLowerCase().trim()}
  `

  if (!rows.length) return { error: 'Credenciales incorrectas' }

  const user  = rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return { error: 'Credenciales incorrectas' }

  // ── Sin MFA → sesión normal
  if (!user.totp_enabled) {
    await createSession(user.id)
    redirect(user.role === 'admin' ? '/admin' : '/drive')
  }

  // ── Con MFA → guardar token pendiente y devolver { mfa: true }
  //    El redirect lo hace el cliente DESPUÉS de que la cookie se guardó
  const pendingToken = randomUUID()
  const expiresAt    = new Date(Date.now() + 5 * 60 * 1000)

  await sql`
    INSERT INTO sessions (id, user_id, expires_at, pending_mfa)
    VALUES (${pendingToken}, ${user.id}, ${expiresAt.toISOString()}, TRUE)
  `

  const cookieStore = await cookies()
  cookieStore.set('mfa_pending', pendingToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires:  expiresAt,
    path:     '/',
  })

  // No llamamos redirect() aquí — lo hace el LoginForm al recibir { mfa: true }
  return { mfa: true }
}

// ─────────────────────────────────────────────────────────────
// 2. VERIFICAR CÓDIGO TOTP
// ─────────────────────────────────────────────────────────────
export async function verifyMfaAction(formData: FormData) {
  const code = (formData.get('code') as string)?.replace(/\s/g, '')

  const cookieStore  = await cookies()
  const pendingToken = cookieStore.get('mfa_pending')?.value
  if (!pendingToken) return { error: 'Sesión expirada. Vuelve a iniciar sesión.' }

  const rows = await sql`
    SELECT s.user_id, u.role, u.totp_secret
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id          = ${pendingToken}
      AND s.pending_mfa = TRUE
      AND s.expires_at  > NOW()
  `

  if (!rows.length) {
    cookieStore.delete('mfa_pending')
    return { error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  const { user_id, role, totp_secret } = rows[0]

  const totp = new OTPAuth.TOTP({
    secret:    OTPAuth.Secret.fromBase32(totp_secret),
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
  })

  const delta = totp.validate({ token: code, window: 1 })

  if (delta === null) {
    const recovered = await tryRecoveryCode(user_id, code)
    if (!recovered) return { error: 'Código incorrecto. Inténtalo de nuevo.' }
  }

  await sql`DELETE FROM sessions WHERE id = ${pendingToken}`
  cookieStore.delete('mfa_pending')

  await createSession(user_id)
  redirect(role === 'admin' ? '/admin' : '/drive')
}

// ─────────────────────────────────────────────────────────────
// 3. CONFIGURAR MFA — solo confirma el código y activa
// ─────────────────────────────────────────────────────────────
export async function confirmMfaAction(formData: FormData) {
  const code = (formData.get('code') as string)?.replace(/\s/g, '')
  const user = await getSession()
  if (!user) return { error: 'No autenticado' }

  const rows = await sql`SELECT totp_secret FROM users WHERE id = ${user.id}`
  if (!rows.length || !rows[0].totp_secret) return { error: 'Configura el MFA primero.' }

  const totp = new OTPAuth.TOTP({
    secret:    OTPAuth.Secret.fromBase32(rows[0].totp_secret),
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
  })

  const delta = totp.validate({ token: code, window: 1 })
  if (delta === null) return { error: 'Código incorrecto. Asegúrate de escanear bien el QR.' }

  await sql`UPDATE users SET totp_enabled = TRUE WHERE id = ${user.id}`

  const recoveryCodes = Array.from({ length: 8 }, () =>
    Math.random().toString(36).slice(2, 8).toUpperCase()
  )

  await sql`DELETE FROM mfa_recovery_codes WHERE user_id = ${user.id}`
  for (const c of recoveryCodes) {
    const hash = await bcrypt.hash(c, 10)
    await sql`INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES (${user.id}, ${hash})`
  }

  return { success: true, recoveryCodes }
}

// ─────────────────────────────────────────────────────────────
// 4. DESACTIVAR MFA
// ─────────────────────────────────────────────────────────────
export async function disableMfaAction(formData: FormData) {
  const code = (formData.get('code') as string)?.replace(/\s/g, '')
  const user = await getSession()
  if (!user) return { error: 'No autenticado' }

  const rows = await sql`SELECT totp_secret FROM users WHERE id = ${user.id}`
  if (!rows.length || !rows[0].totp_secret) return { error: 'MFA no configurado.' }

  const totp = new OTPAuth.TOTP({
    secret:    OTPAuth.Secret.fromBase32(rows[0].totp_secret),
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
  })

  const delta = totp.validate({ token: code, window: 1 })
  if (delta === null) return { error: 'Código incorrecto.' }

  await sql`UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = ${user.id}`
  await sql`DELETE FROM mfa_recovery_codes WHERE user_id = ${user.id}`

  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// 5. LOGOUT
// ─────────────────────────────────────────────────────────────
export async function logoutAction() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value
  if (sessionId) {
    await sql`DELETE FROM sessions WHERE id = ${sessionId}`
    cookieStore.delete('session_id')
  }
  redirect('/login')
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
async function createSession(userId: number) {
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${sessionId}, ${userId}, ${expiresAt.toISOString()})
  `

  const cookieStore = await cookies()
  cookieStore.set('session_id', sessionId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires:  expiresAt,
    path:     '/',
  })
}

async function tryRecoveryCode(userId: number, inputCode: string): Promise<boolean> {
  const codes = await sql`
    SELECT id, code_hash FROM mfa_recovery_codes
    WHERE user_id = ${userId} AND used = FALSE
  `
  for (const row of codes) {
    const match = await bcrypt.compare(inputCode.toUpperCase(), row.code_hash)
    if (match) {
      await sql`UPDATE mfa_recovery_codes SET used = TRUE WHERE id = ${row.id}`
      return true
    }
  }
  return false
}

export async function getCurrentUser() {
  return getSession()
}