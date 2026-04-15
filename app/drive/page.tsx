import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { getUserFolders } from '@/app/actions/users'
import AppShell from '@/components/app-shell'
import DriveExplorer from '@/components/drive-explorer'

export default async function DrivePage() {
  let user
  try {
    user = await requireSession()
  } catch {
    redirect('/login')
  }

  if (user.role === 'admin') redirect('/admin')

  const folders = await getUserFolders(user.id)

  return (
    <AppShell user={user} activePath="/drive">
      <DriveExplorer
        initialFolders={folders as any[]}
        userId={user.id}
        isAdmin={false}
      />
    </AppShell>
  )
}
