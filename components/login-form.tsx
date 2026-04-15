'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'

export default function LoginForm() {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return loginAction(formData)
    },
    null
  )

  return (
    <form
      action={action}
      className="rounded-lg border border-border bg-card p-8 flex flex-col gap-5 shadow-2xl"
      style={{ boxShadow: '0 0 40px rgba(0,100,255,0.08)' }}
    >
      <div>
        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="usuario@samtech.cl"
          className="w-full rounded border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full rounded border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
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
        {pending ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  )
}
