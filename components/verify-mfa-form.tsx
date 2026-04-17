'use client'

import { useActionState, useState } from 'react'
import { verifyMfaAction } from '@/app/actions/auth'
import Link from 'next/link'

export default function VerifyMfaForm() {
  const [showRecovery, setShowRecovery] = useState(false)

  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return verifyMfaAction(formData)
    },
    null
  )

  return (
    <div
      className="rounded-lg border border-border bg-card p-8 flex flex-col gap-5 shadow-2xl"
      style={{ boxShadow: '0 0 40px rgba(0,100,255,0.08)' }}
    >
      {/* Ícono escudo */}
      <div className="flex justify-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,100,255,0.1)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
      </div>

      {!showRecovery ? (
        <>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Abre tu app autenticadora (Google Authenticator, Authy, etc.) e ingresa el código de 6 dígitos.
            </p>
          </div>

          <form action={action} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="code"
                className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2"
              >
                Código de verificación
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                autoComplete="one-time-code"
                placeholder="000 000"
                className="w-full rounded border border-border bg-input px-4 py-3 text-2xl text-center tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition font-mono"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-400 text-center">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2.5 rounded font-semibold text-sm uppercase tracking-widest text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--samtech-blue)' }}
            >
              {pending ? 'Verificando...' : 'Verificar'}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Ingresa uno de tus <strong>códigos de recuperación</strong>. Cada código solo se puede usar una vez.
            </p>
          </div>

          <form action={action} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="code"
                className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2"
              >
                Código de recuperación
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                autoComplete="off"
                placeholder="XXXXXX"
                className="w-full rounded border border-border bg-input px-4 py-3 text-lg text-center tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition font-mono uppercase"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-400 text-center">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2.5 rounded font-semibold text-sm uppercase tracking-widest text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--samtech-blue)' }}
            >
              {pending ? 'Verificando...' : 'Usar código de recuperación'}
            </button>
          </form>
        </>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="button"
          onClick={() => setShowRecovery((v) => !v)}
          className="text-xs text-center text-muted-foreground hover:text-foreground transition underline underline-offset-2"
        >
          {showRecovery ? '← Usar código de autenticador' : '¿No tienes acceso al teléfono? Usa un código de recuperación'}
        </button>
        <Link
          href="/login"
          className="text-xs text-center text-muted-foreground hover:text-foreground transition underline underline-offset-2"
        >
          ← Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}