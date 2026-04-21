'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/auth'
import MfaStatusWidget from '@/components/mfa-status-widget'

interface NavLink {
  href: string
  label: string
  icon: string
}

interface Props {
  user: SessionUser
  isAdmin: boolean
  mfaEnabled: boolean
  navLinks: NavLink[]
  activePath?: string
  logoutAction: () => Promise<void>
  children: React.ReactNode
}

export default function AppShellClient({
  user, isAdmin, mfaEnabled, navLinks, activePath, logoutAction, children
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function SidebarContent() {
    return (
      <>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          {/* Botón cerrar en móvil */}
          <button
            className="md:hidden p-1 rounded text-muted-foreground hover:text-foreground transition"
            onClick={() => setSidebarOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navLinks.map(({ href, label, icon }) => {
            const active = activePath === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors"
                style={{
                  background: active ? 'rgba(0,100,255,0.15)' : 'transparent',
                  color: active ? 'var(--samtech-blue-bright)' : 'var(--sidebar-foreground)',
                }}
              >
                <NavIcon name={icon} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Usuario + MFA + Logout */}
        <div className="px-4 py-4 border-t border-border flex flex-col gap-3">
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

          <MfaStatusWidget mfaEnabled={mfaEnabled} />

          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Cerrar sesión
            </button>
          </form>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Sidebar desktop (siempre visible en md+) ── */}
      <aside
        className="hidden md:flex w-60 flex-col border-r border-border flex-shrink-0"
        style={{ background: 'var(--sidebar)' }}
      >
        <SidebarContent />
      </aside>

      {/* ── Sidebar móvil (drawer) ── */}
      {sidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-border md:hidden"
            style={{ background: 'var(--sidebar)' }}
          >
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar móvil */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0"
          style={{ background: 'var(--sidebar)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded text-muted-foreground hover:text-foreground transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 flex items-center justify-center"
              style={{ background: 'var(--samtech-blue)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span className="font-bold tracking-widest text-sm uppercase text-foreground">SAMTECH</span>
          </div>

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--samtech-blue)' }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function NavIcon({ name }: { name: string }) {
  if (name === 'folder') return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
  if (name === 'users') return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
  if (name === 'activity') return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
  return null
}