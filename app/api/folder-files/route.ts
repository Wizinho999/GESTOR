import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getFolderFiles } from '@/app/actions/users'

export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folderId = Number(request.nextUrl.searchParams.get('folder_id'))
  if (!folderId) return NextResponse.json({ error: 'Missing folder_id' }, { status: 400 })

  const files = await getFolderFiles(folderId, user.id, user.role === 'admin')
  return NextResponse.json({ files })
}
