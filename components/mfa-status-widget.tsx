'use client'

import { useActionState, useState } from 'react'
import { disableMfaAction } from '@/app/actions/auth'
import Link from 'next/link'

interface Props {
  mfaEnabled: boolean
}

export default function MfaStatusWidget({ mfaEnabled }: Props) {
  const [showDisableForm, setShowDisableForm] = useState(false)

  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      return disableMfaAction(formData)
    },
    null
  )

  // Tras desactivar exitosamente
  if (state?.success) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
        <span className="text-xs text-muted-foreground">MFA desactivado — recarga</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">

      {/* Fila principal: ícono + estado + botón */}
      <div className="flex items-center gap-2 px-1">
        {/* Punto de estado */}
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: mfaEnabled ? '#22c55e' : '#ef4444' }}
        />

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground leading-tight truncate">
            2FA {mfaEnabled ? 'activo' : 'inactivo'}
          </p>
        </div>

        {/* Botón acción */}
        {mfaEnabled ? (
          <button
            type="button"
            onClick={() => setShowDisableForm((v) => !v)}
            className="text-[10px] text-red-400 hover:text-red-300 transition underline underline-offset-2 flex-shrink-0"
          >
            {showDisableForm ? 'Cancelar' : 'Desactivar'}
          </button>
        ) : (
          <Link
            href="/setup-mfa"
            className="text-[10px] font-semibold px-2 py-0.5 rounded text-white flex-shrink-0 transition hover:opacity-80"
            style={{ background: 'var(--samtech-blue)' }}
          >
            Activar
          </Link>
        )}
      </div>

      {/* Formulario para desactivar (se expande debajo) */}
      {showDisableForm && (
        <form action={action} className="flex flex-col gap-1.5 px-1">
          <input
            name="code"
            type="text"
            inputMode="numeric"
            maxLength={7}
            required
            placeholder="Código 000 000"
            className="w-full rounded border border-border bg-input px-2 py-1.5 text-xs font-mono text-center tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition"
          />
          {state?.error && (
            <p className="text-[10px] text-red-400 text-center">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full py-1 rounded text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50"
          >
            {pending ? 'Verificando...' : 'Confirmar desactivación'}
          </button>
        </form>
      )}
    </div>
  )
}