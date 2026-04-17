'use client'

import { useActionState, useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { confirmMfaAction } from '@/app/actions/auth'

interface Props {
  otpUri:    string
  secret:    string
  userEmail: string
}

type ConfirmResult = {
  success?: boolean
  recoveryCodes?: string[]
  error?: string
} | null

export default function SetupMfaClient({ otpUri, secret, userEmail }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [state, action, pending] = useActionState(
    async (_prev: ConfirmResult, formData: FormData): Promise<ConfirmResult> => {
      const result = await confirmMfaAction(formData)
      return result
    },
    null
  )

  useEffect(() => {
    QRCode.toDataURL(otpUri, { width: 200, margin: 1, color: { dark: '#ffffff', light: '#00000000' } })
      .then(setQrDataUrl)
      .catch(console.error)
  }, [otpUri])

  function copySecret() {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Pantalla de éxito: mostrar códigos de recuperación
  if (state?.success && state.recoveryCodes) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-8 flex flex-col gap-5 shadow-2xl"
        style={{ boxShadow: '0 0 40px rgba(0,100,255,0.08)' }}
      >
        <div className="flex justify-center">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.1)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h2 className="font-bold text-lg text-foreground mb-1">¡MFA activado correctamente!</h2>
          <p className="text-sm text-muted-foreground">
            Guarda estos códigos de recuperación en un lugar seguro. Si pierdes acceso a tu teléfono, los necesitarás para entrar.
          </p>
        </div>

        <div className="rounded border border-border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Códigos de recuperación — úsalos solo en emergencias
          </p>
          <div className="grid grid-cols-2 gap-2">
            {state.recoveryCodes.map((code) => (
              <div
                key={code}
                className="font-mono text-sm text-foreground bg-card rounded px-3 py-1.5 text-center tracking-widest border border-border"
              >
                {code}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-amber-400 text-center">
          ⚠ Cada código se puede usar una sola vez. Guárdalos ahora — no los verás de nuevo.
        </p>

        <a
          href="/drive"
          className="w-full py-2.5 rounded font-semibold text-sm uppercase tracking-widest text-white transition text-center block"
          style={{ background: 'var(--samtech-blue)' }}
        >
          Continuar al portal
        </a>
      </div>
    )
  }

  // ── Formulario de configuración
  return (
    <div
      className="rounded-lg border border-border bg-card p-8 flex flex-col gap-6 shadow-2xl"
      style={{ boxShadow: '0 0 40px rgba(0,100,255,0.08)' }}
    >
      {/* Paso 1 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'var(--samtech-blue)' }}
          >1</span>
          <p className="text-sm font-semibold text-foreground">Instala una app autenticadora</p>
        </div>
        <p className="text-xs text-muted-foreground ml-9">
          Descarga <strong>Google Authenticator</strong> o <strong>Authy</strong> en tu celular.
        </p>
      </div>

      {/* Paso 2: QR */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'var(--samtech-blue)' }}
          >2</span>
          <p className="text-sm font-semibold text-foreground">Escanea este código QR</p>
        </div>

        <div className="flex flex-col items-center gap-3 ml-9">
          {qrDataUrl ? (
            <div
              className="rounded-lg p-3 flex items-center justify-center"
              style={{ background: 'rgba(0,100,255,0.08)', border: '1px solid rgba(0,100,255,0.2)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR MFA" width={180} height={180} />
            </div>
          ) : (
            <div
              className="w-[180px] h-[180px] rounded-lg animate-pulse"
              style={{ background: 'rgba(0,100,255,0.08)' }}
            />
          )}

          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2"
          >
            {showSecret ? 'Ocultar clave manual' : '¿No puedes escanear? Ver clave manual'}
          </button>

          {showSecret && (
            <div className="w-full rounded border border-border bg-background p-3 flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-foreground break-all">{secret}</code>
              <button
                type="button"
                onClick={copySecret}
                className="text-xs text-muted-foreground hover:text-foreground transition flex-shrink-0"
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Paso 3: Confirmar */}
      <form action={action} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'var(--samtech-blue)' }}
          >3</span>
          <p className="text-sm font-semibold text-foreground">Confirma con el código generado</p>
        </div>

        <div className="ml-9">
          <input
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
          <p className="text-sm text-red-400 text-center ml-9">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 rounded font-semibold text-sm uppercase tracking-widest text-white transition disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          style={{ background: 'var(--samtech-blue)' }}
        >
          {pending ? 'Activando...' : 'Activar autenticación en dos pasos'}
        </button>
      </form>
    </div>
  )
}