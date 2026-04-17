import MfaStatusWidget from '@/components/mfa-status-widget'
import { getSession } from '@/lib/auth'
import sql from '@/lib/db'
import { redirect } from 'next/dist/client/components/navigation'

export default async function ProfilePage() {
  const user = await getSession()
  if (!user) redirect('/login')

  const rows = await sql`SELECT totp_enabled FROM users WHERE id = ${user.id}`
  const mfaEnabled = rows[0]?.totp_enabled ?? false

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-lg font-bold mb-4">Mi cuenta</h1>
      <MfaStatusWidget mfaEnabled={mfaEnabled} />
    </div>
  )
}