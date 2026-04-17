import { requireAdmin } from '@/lib/auth'
import { getFoldersAdmin } from '@/app/actions/files'
import AppShell from '@/components/app-shell'
import AdminFilesManager from '@/components/admin-files-manager'

export default async function AdminPage() {
  const user = await requireAdmin()
  const folders = await getFoldersAdmin()

  return (
    <AppShell user={user} activePath="/admin">
      <AdminFilesManager initialFolders={folders as any[]} />
    </AppShell>
  )
}

