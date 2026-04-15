import { requireAdmin } from '@/lib/auth'
import { getAllUsers } from '@/app/actions/users'
import { getFoldersAdmin } from '@/app/actions/files'
import AppShell from '@/components/app-shell'
import AdminUsersManager from '@/components/admin-users-manager'

export default async function AdminUsersPage() {
  const user = await requireAdmin()
  const [users, folders] = await Promise.all([getAllUsers(), getFoldersAdmin()])

  return (
    <AppShell user={user} activePath="/admin/users">
      <AdminUsersManager
        initialUsers={users as any[]}
        folders={folders as any[]}
        currentUserId={user.id}
      />
    </AppShell>
  )
}
