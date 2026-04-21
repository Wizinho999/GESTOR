import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getFolderFiles, getUserSubfolders } from '@/app/actions/users'

export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folderId = Number(request.nextUrl.searchParams.get('folder_id'))
  if (!folderId) return NextResponse.json({ error: 'Missing folder_id' }, { status: 400 })

  const isAdmin = user.role === 'admin'

  const [files, subfolders] = await Promise.all([
    getFolderFiles(folderId, user.id, isAdmin),
    isAdmin
      ? // Admin ve todas las subcarpetas
        import('@/lib/db').then(({ default: sql }) =>
          sql`
            SELECT f.*,
              (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count,
              (SELECT COUNT(*) FROM folders sub WHERE sub.parent_id = f.id) as subfolder_count
            FROM folders f
            WHERE f.parent_id = ${folderId}
            ORDER BY f.name ASC
          `
        )
      : getUserSubfolders(folderId, user.id),
  ])

  return NextResponse.json({ files, subfolders })
}