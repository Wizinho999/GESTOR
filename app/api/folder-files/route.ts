import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getFolderFiles } from '@/app/actions/users'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folderId = Number(request.nextUrl.searchParams.get('folder_id'))
  if (!folderId) return NextResponse.json({ error: 'Missing folder_id' }, { status: 400 })

  const isAdmin = user.role === 'admin'

  // ── Verificar si el usuario puede gestionar esta carpeta o algún ancestro ──
  let canManage = isAdmin
  if (!isAdmin) {
    const result = await sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id, f.parent_id FROM folders f
        JOIN ancestors a ON a.parent_id = f.id
      )
      SELECT fp.can_manage FROM folder_permissions fp
      JOIN ancestors a ON a.id = fp.folder_id
      WHERE fp.user_id = ${user.id}
      ORDER BY fp.can_manage DESC
      LIMIT 1
    `
    canManage = result.length > 0 && result[0].can_manage === true
  }

  // ── Subcarpetas — siempre heredan el can_manage del padre ──
  const subfolders = await sql`
    SELECT f.*,
      (SELECT COUNT(*) FROM files fi WHERE fi.folder_id = f.id) as file_count,
      (SELECT COUNT(*) FROM folders sub WHERE sub.parent_id = f.id) as subfolder_count,
      ${canManage} as can_manage
    FROM folders f
    WHERE f.parent_id = ${folderId}
    ORDER BY f.name ASC
  `

  // ── Archivos ──
  const files = await getFolderFiles(folderId, user.id, isAdmin)

  return NextResponse.json({ files, subfolders, can_manage: canManage })
}