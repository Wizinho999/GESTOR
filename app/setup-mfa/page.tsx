import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import * as OTPAuth from 'otpauth'
import sql from '@/lib/db'
import SetupMfaClient from '@/components/stup-mfa-client'

export default async function SetupMfaPage() {
  const user = await getSession()
  if (!user) redirect('/login')

  // Generar secreto TOTP directamente aquí (sin llamar a server action)
  const secret = new OTPAuth.Secret({ size: 20 })

  const totp = new OTPAuth.TOTP({
    issuer:    'SAMTECH',
    label:     user.email,
    algorithm: 'SHA1',
    digits:    6,
    period:    30,
    secret,
  })

  const otpUri = totp.toString()

  // Guardar el secreto en DB (sin activar MFA todavía)
  await sql`UPDATE users SET totp_secret = ${secret.base32} WHERE id = ${user.id}`

  return (
    <main className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] opacity-5"
          style={{ background: 'radial-gradient(circle, var(--samtech-blue) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(var(--samtech-blue) 1px, transparent 1px),
              linear-gradient(90deg, var(--samtech-blue) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{
                background: 'var(--samtech-blue)',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-widest text-foreground uppercase">SAMTECH</span>
          </div>
          <p className="text-muted-foreground text-sm tracking-wide uppercase">Configurar autenticación en dos pasos</p>
        </div>

        <SetupMfaClient otpUri={otpUri} secret={secret.base32} userEmail={user.email} />
      </div>
    </main>
  )
}