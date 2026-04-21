// ⚠ Reemplaza components/app-shell.tsx

import { logoutAction } from '@/app/actions/auth'
import type { SessionUser } from '@/lib/auth'
import Link from 'next/link'
import sql from '@/lib/db'
import MfaStatusWidget from '@/components/mfa-status-widget'
import AppShellClient from '@/components/app-shell-client'

interface AppShellProps {
  user: SessionUser
  children: React.ReactNode
  activePath?: string
}

export default async function AppShell({ user, children, activePath }: AppShellProps) {
  const isAdmin = user.role === 'admin'

  const rows = await sql`SELECT totp_enabled FROM users WHERE id = ${user.id}`
  const mfaEnabled = rows[0]?.totp_enabled ?? false

  const navLinks = isAdmin
    ? [
        { href: '/admin',          label: 'Archivos',  icon: 'folder'   },
        { href: '/admin/users',    label: 'Usuarios',  icon: 'users'    },
        { href: '/admin/activity', label: 'Actividad', icon: 'activity' },
      ]
    : [
        { href: '/drive', label: 'Mis Documentos', icon: 'folder' },
      ]

  return (
    <AppShellClient
      user={user}
      isAdmin={isAdmin}
      mfaEnabled={mfaEnabled}
      navLinks={navLinks}
      activePath={activePath}
      logoutAction={logoutAction}
    >
      {children}
    </AppShellClient>
  )
}