import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const pattern = `%${q}%`

  let results

  if (user.role === 'admin') {
    // Admin ve todos los archivos y carpetas
    results = await sql`
      SELECT
        'file' as type,
        fi.id,
        fi.name,
        fi.blob_url,
        fi.size_bytes,
        fo.name as folder_name,
        fo.id   as folder_id
      FROM files fi
      LEFT JOIN folders fo ON fo.id = fi.folder_id
      WHERE fi.name ILIKE ${pattern}
      ORDER BY fi.name ASC
      LIMIT 20
    `
  } else {
    // Usuario solo ve archivos de carpetas que tiene permiso
    results = await sql`
      WITH RECURSIVE accessible_folders AS (
        -- Carpetas raíz con permiso directo
        SELECT f.id FROM folders f
        JOIN folder_permissions fp ON fp.folder_id = f.id
        WHERE fp.user_id = ${user.id}
        UNION ALL
        -- Subcarpetas de esas carpetas
        SELECT f.id FROM folders f
        JOIN accessible_folders af ON af.id = f.parent_id
      )
      SELECT
        'file' as type,
        fi.id,
        fi.name,
        fi.blob_url,
        fi.size_bytes,
        fo.name as folder_name,
        fo.id   as folder_id
      FROM files fi
      JOIN folders fo ON fo.id = fi.folder_id
      JOIN accessible_folders af ON af.id = fi.folder_id
      WHERE fi.name ILIKE ${pattern}
      ORDER BY fi.name ASC
      LIMIT 20
    `
  }

  return NextResponse.json({ results })
}