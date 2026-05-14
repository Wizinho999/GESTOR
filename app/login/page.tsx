import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import LoginForm from '@/components/login-form'

export default async function LoginPage() {
  const user = await getSession()
  if (user) {
    redirect(user.role === 'admin' ? '/admin' : '/drive')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background geometric accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] opacity-5"
          style={{
            background: 'radial-gradient(circle, var(--samtech-blue) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] opacity-5"
          style={{
            background: 'radial-gradient(circle, var(--samtech-blue) 0%, transparent 70%)',
          }}
        />
        {/* Grid lines */}
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

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <img src="/logo samtech blanco.svg" alt="Logo" className="h-12 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm tracking-wide uppercase">Portal de Documentos</p>
        </div>

        <LoginForm />
      </div>
    </main>
  )
}
