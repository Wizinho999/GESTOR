'use client'

import { useState, useTransition } from 'react'
import {
  createUserAction,
  deleteUserAction,
} from '@/app/actions/users'

interface User {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

interface Folder {
  id: number
  name: string
}

interface AdminUsersManagerProps {
  initialUsers: User[]
  folders: Folder[]
  currentUserId: number
}

export default function AdminUsersManager({
  initialUsers,
  folders,
  currentUserId,
}: AdminUsersManagerProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [showNewUser, setShowNewUser] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<number[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [savingPerms, setSavingPerms] = useState(false)

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createUserAction(fd)
      if (result?.error) {
        setFormError(result.error)
        return
      }
      setShowNewUser(false)
      // Reload users
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(data.users || [])
    })
  }

  async function handleDeleteUser(userId: number) {
    if (!confirm('¿Eliminar este usuario?')) return
    await deleteUserAction(userId)
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  async function openPermissions(user: User) {
    setPermissionsUser(user)
    setLoadingPerms(true)
    try {
      const res = await fetch(`/api/admin/permissions?user_id=${user.id}`)
      const data = await res.json()
      setUserPermissions(data.folder_ids || [])
    } finally {
      setLoadingPerms(false)
    }
  }

  function togglePermission(folderId: number) {
    setUserPermissions((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    )
  }

  async function savePermissions() {
    if (!permissionsUser) return
    setSavingPerms(true)
    try {
      await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: permissionsUser.id, folder_ids: userPermissions }),
      })
      setPermissionsUser(null)
    } finally {
      setSavingPerms(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNewUser(true)}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white transition flex-shrink-0"
          style={{ background: 'var(--samtech-blue)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {/* New user form */}
      {showNewUser && (
        <form
          onSubmit={handleCreateUser}
          className="mb-8 p-6 rounded-lg border border-border"
          style={{ background: 'var(--samtech-surface)' }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            Crear usuario
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                Nombre
              </label>
              <input
                name="name"
                required
                placeholder="Nombre completo"
                className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                Correo
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="usuario@samtech.cl"
                className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                Contraseña
              </label>
              <input
                name="password"
                type="password"
                required
                placeholder="Contraseña temporal"
                className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                Rol
              </label>
              <select
                name="role"
                className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          {formError && <p className="text-sm text-red-400 mb-3">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--samtech-blue)' }}
            >
              {isPending ? 'Creando...' : 'Crear usuario'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewUser(false); setFormError('') }}
              className="px-4 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Users table */}
      <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'var(--samtech-surface)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Correo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Registrado</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: u.role === 'admin' ? 'var(--samtech-blue)' : 'rgba(255,255,255,0.15)' }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                    style={{
                      background: u.role === 'admin' ? 'rgba(0,100,255,0.15)' : 'rgba(255,255,255,0.07)',
                      color: u.role === 'admin' ? 'var(--samtech-blue-bright)' : 'var(--muted-foreground)',
                    }}
                  >
                    {u.role === 'admin' ? 'Admin' : 'Usuario'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                  {new Date(u.created_at).toLocaleDateString('es-CL')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => openPermissions(u)}
                        className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                        style={{ background: 'rgba(0,100,255,0.15)', color: 'var(--samtech-blue-bright)' }}
                      >
                        Permisos
                      </button>
                    )}
                    {u.id !== currentUserId && u.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                        style={{ background: 'rgba(255,60,60,0.12)', color: '#ff6b6b' }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No hay usuarios registrados.</p>
          </div>
        )}
      </div>

      {/* Permissions modal */}
      {permissionsUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border shadow-2xl"
            style={{ background: 'var(--samtech-surface)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Permisos de acceso</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{permissionsUser.name}</p>
              </div>
              <button
                onClick={() => setPermissionsUser(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {loadingPerms ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <div
                    className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--samtech-blue)', borderTopColor: 'transparent' }}
                  />
                  <span className="text-sm text-muted-foreground">Cargando permisos...</span>
                </div>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay carpetas creadas aún.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {folders.map((folder) => {
                    const checked = userPermissions.includes(folder.id)
                    return (
                      <label
                        key={folder.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors hover:bg-secondary"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(folder.id)}
                          className="w-4 h-4 accent-blue-500 flex-shrink-0"
                        />
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="text-sm text-foreground">{folder.name}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={savePermissions}
                disabled={savingPerms}
                className="flex-1 py-2 rounded text-sm font-semibold text-white disabled:opacity-50 transition"
                style={{ background: 'var(--samtech-blue)' }}
              >
                {savingPerms ? 'Guardando...' : 'Guardar permisos'}
              </button>
              <button
                onClick={() => setPermissionsUser(null)}
                className="px-4 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

