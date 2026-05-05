'use client'

import { useState, useTransition } from 'react'
import { createUserAction, deleteUserAction } from '@/app/actions/users'

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

// Permiso por carpeta: acceso + puede gestionar
interface FolderPerm {
  folderId: number
  canManage: boolean
}

interface AdminUsersManagerProps {
  initialUsers: User[]
  folders: Folder[]
  currentUserId: number
}

export default function AdminUsersManager({ initialUsers, folders, currentUserId }: AdminUsersManagerProps) {
  const [users, setUsers]                   = useState<User[]>(initialUsers)
  const [showNewUser, setShowNewUser]       = useState(false)
  const [isPending, startTransition]        = useTransition()
  const [formError, setFormError]           = useState('')
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null)
  const [folderPerms, setFolderPerms]       = useState<FolderPerm[]>([])
  const [loadingPerms, setLoadingPerms]     = useState(false)
  const [savingPerms, setSavingPerms]       = useState(false)

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createUserAction(fd)
      if (result?.error) { setFormError(result.error); return }
      setShowNewUser(false)
      const res  = await fetch('/api/admin/users', { credentials: 'include' })
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
      const res  = await fetch(`/api/admin/permissions?user_id=${user.id}`, {
        credentials: 'include',
      })
      const data = await res.json()
      // data.permissions = [{ folder_id, can_manage }]
      const perms: FolderPerm[] = (data.permissions || []).map((p: { folder_id: number; can_manage: boolean }) => ({
        folderId:  p.folder_id,
        canManage: p.can_manage,
      }))
      setFolderPerms(perms)
    } finally {
      setLoadingPerms(false)
    }
  }

  function toggleAccess(folderId: number) {
    setFolderPerms((prev) => {
      const exists = prev.find((p) => p.folderId === folderId)
      if (exists) {
        // Quitar acceso completamente
        return prev.filter((p) => p.folderId !== folderId)
      }
      // Dar acceso (solo lectura por defecto)
      return [...prev, { folderId, canManage: false }]
    })
  }

  function toggleManage(folderId: number) {
    setFolderPerms((prev) =>
      prev.map((p) => p.folderId === folderId ? { ...p, canManage: !p.canManage } : p)
    )
  }

  function hasAccess(folderId: number) {
    return folderPerms.some((p) => p.folderId === folderId)
  }

  function hasManage(folderId: number) {
    return folderPerms.some((p) => p.folderId === folderId && p.canManage)
  }

  async function savePermissions() {
    if (!permissionsUser) return
    setSavingPerms(true)
    try {
      await fetch('/api/admin/permissions', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({
          user_id:     permissionsUser.id,
          permissions: folderPerms.map((p) => ({
            folder_id:  p.folderId,
            can_manage: p.canManage,
          })),
        }),
      })
      setPermissionsUser(null)
    } finally {
      setSavingPerms(false)
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-3">
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

      {/* Formulario nuevo usuario */}
      {showNewUser && (
        <form
          onSubmit={handleCreateUser}
          className="mb-8 p-6 rounded-lg border border-border"
          style={{ background: 'var(--samtech-surface)' }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-5">Crear usuario</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {[
              { label: 'Nombre',      name: 'name',     type: 'text',     placeholder: 'Nombre completo' },
              { label: 'Correo',      name: 'email',    type: 'email',    placeholder: 'usuario@samtech.cl' },
              { label: 'Contraseña', name: 'password', type: 'password', placeholder: 'Contraseña temporal' },
            ].map(({ label, name, type, placeholder }) => (
              <div key={name}>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</label>
                <input
                  name={name} type={type} required placeholder={placeholder}
                  className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Rol</label>
              <select name="role" className="w-full rounded border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          {formError && <p className="text-sm text-red-400 mb-3">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="px-4 py-2 rounded text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--samtech-blue)' }}>
              {isPending ? 'Creando...' : 'Crear usuario'}
            </button>
            <button type="button" onClick={() => { setShowNewUser(false); setFormError('') }} className="px-4 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla de usuarios */}
      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border"
            style={{ background: 'var(--samtech-surface)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: u.role === 'admin' ? 'var(--samtech-blue)' : 'rgba(255,255,255,0.15)' }}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            <span
              className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded hidden sm:inline flex-shrink-0"
              style={{
                background: u.role === 'admin' ? 'rgba(0,100,255,0.15)' : 'rgba(255,255,255,0.07)',
                color:      u.role === 'admin' ? 'var(--samtech-blue-bright)' : 'var(--muted-foreground)',
              }}
            >
              {u.role === 'admin' ? 'Admin' : 'Usuario'}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
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
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No hay usuarios registrados.</p>
          </div>
        )}
      </div>

      {/* Modal de permisos */}
      {permissionsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-lg border border-border shadow-2xl" style={{ background: 'var(--samtech-surface)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Permisos de acceso</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{permissionsUser.name}</p>
              </div>
              <button onClick={() => setPermissionsUser(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {loadingPerms ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--samtech-blue)', borderTopColor: 'transparent' }} />
                  <span className="text-sm text-muted-foreground">Cargando permisos...</span>
                </div>
              ) : folders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay carpetas creadas aún.</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                  {/* Leyenda */}
                  <div className="grid grid-cols-3 gap-2 px-3 pb-2 mb-1 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Carpeta</span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">Acceso</span>
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">Gestionar</span>
                  </div>

                  {folders.map((folder) => {
                    const access  = hasAccess(folder.id)
                    const manage  = hasManage(folder.id)
                    return (
                      <div key={folder.id} className="grid grid-cols-3 gap-2 items-center px-3 py-2 rounded hover:bg-secondary/40 transition-colors">
                        {/* Nombre */}
                        <div className="flex items-center gap-2 min-w-0">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2" className="flex-shrink-0">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="text-sm text-foreground truncate">{folder.name}</span>
                        </div>

                        {/* Checkbox acceso */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={access}
                            onChange={() => toggleAccess(folder.id)}
                            className="w-4 h-4 accent-blue-500"
                          />
                        </div>

                        {/* Checkbox gestionar — solo si tiene acceso */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={manage}
                            disabled={!access}
                            onChange={() => access && toggleManage(folder.id)}
                            className="w-4 h-4 accent-orange-400 disabled:opacity-30"
                            title={!access ? 'Primero activa el acceso' : 'Puede subir, renombrar y borrar en esta carpeta'}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Leyenda de iconos */}
              <div className="mt-4 pt-3 border-t border-border flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Acceso</span> — puede ver los documentos de la carpeta
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">Gestionar</span> — puede subir, renombrar y eliminar archivos en esa carpeta (admin de carpeta)
                </p>
              </div>
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