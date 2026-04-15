import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function RootPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role === 'admin') redirect('/admin')
  redirect('/drive')
}
