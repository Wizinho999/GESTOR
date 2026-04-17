import { logoutAction } from '@/app/actions/auth'
import type { SessionUser } from '@/lib/auth'
import Link from 'next/link'
import sql from '@/lib/db'
import MfaStatusWidget from '@/components/mfa-status-widget'

interface AppShellProps {
  user: SessionUser
  children: React.ReactNode
  activePath?: string
}

export default async function AppShell({ user, children, activePath }: AppShellProps) {
  const isAdmin = user.role === 'admin'

  // Leemos si el usuario tiene MFA activo para mostrarlo en el widget
  const rows = await sql`SELECT totp_enabled FROM users WHERE id = ${user.id}`
  const mfaEnabled = rows[0]?.totp_enabled ?? false

  const navLinks = isAdmin
    ? [
        { href: '/admin',          label: 'Archivos',   icon: FolderIcon   },
        { href: '/admin/users',    label: 'Usuarios',   icon: UsersIcon    },
        { href: '/admin/activity', label: 'Actividad',  icon: ActivityIcon },
      ]
    : [
        { href: '/drive', label: 'Mis Documentos', icon: FolderIcon },
      ]

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r border-border" style={{ background: 'var(--sidebar)' }}>

        {/* Logo */}
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div
            className="w-8 h-8 flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--samtech-blue)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <span className="font-bold tracking-widest text-sm uppercase text-foreground">SAMTECH</span>
        </div>

        {/* Role badge */}
        <div className="px-6 py-3 border-b border-border">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{
              background: isAdmin ? 'rgba(0,100,255,0.15)' : 'rgba(255,255,255,0.07)',
              color: isAdmin ? 'var(--samtech-blue-bright)' : 'var(--muted-foreground)',
            }}
          >
            {isAdmin ? 'Administrador' : 'Usuario'}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = activePath === href
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors"
                style={{
                  background: active ? 'rgba(0,100,255,0.15)' : 'transparent',
                  color: active ? 'var(--samtech-blue-bright)' : 'var(--sidebar-foreground)',
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* ── Zona inferior: usuario + MFA + logout ── */}
        <div className="px-4 py-4 border-t border-border flex flex-col gap-3">

          {/* Nombre y email */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'var(--samtech-blue)' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          {/* ── WIDGET MFA ── */}
          {/* Muestra si el MFA está activo o no, con botón para activar/desactivar */}
          <MfaStatusWidget mfaEnabled={mfaEnabled} />

          {/* Cerrar sesión */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LogoutIcon className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </form>

        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

// ── Íconos ──────────────────────────────────────────────────

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}