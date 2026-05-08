import { requireAdmin } from '@/lib/auth'
import AppShell from '@/components/app-shell'
import sql from '@/lib/db'

export default async function AdminActivityPage() {
  const user = await requireAdmin()

  const recentFiles = await sql`
    SELECT
      fi.id, fi.name, fi.size_bytes, fi.created_at,
      u.name as uploader_name,
      fo.name as folder_name
    FROM files fi
    LEFT JOIN users u ON u.id = fi.uploaded_by
    LEFT JOIN folders fo ON fo.id = fi.folder_id
    ORDER BY fi.created_at DESC
    LIMIT 50
  `

  const stats = await sql`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM folders) AS total_folders,
      (SELECT COUNT(*) FROM files) AS total_files,
      (SELECT COALESCE(SUM(size_bytes),0) FROM files) AS total_size
  `

  const s = stats[0] as any

  function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  const statCards = [
    { label: 'Usuarios', value: s.total_users, icon: 'users' },
    { label: 'Carpetas', value: s.total_folders, icon: 'folder' },
    { label: 'Archivos PDF', value: s.total_files, icon: 'file' },
    { label: 'Almacenamiento', value: formatBytes(Number(s.total_size)), icon: 'database' },
  ]

  return (
    <AppShell user={user} activePath="/admin/activity">
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Actividad del sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumen general y archivos subidos recientemente</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-lg border border-border"
              style={{ background: 'var(--samtech-surface)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{stat.label}</p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Recent uploads */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Archivos subidos recientemente
          </h2>
          {recentFiles.length === 0 ? (
            <div
              className="text-center py-16 rounded-lg border border-border"
              style={{ background: 'var(--samtech-surface)' }}
            >
              <p className="text-muted-foreground text-sm">No hay archivos subidos aún.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'var(--samtech-surface)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">Archivo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Carpeta</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Subido por</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Tamaño</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentFiles as any[]).map((file) => (
                    <tr key={file.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(255,60,60,0.12)' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[180px]">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{file.folder_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{file.uploader_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatBytes(Number(file.size_bytes))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
