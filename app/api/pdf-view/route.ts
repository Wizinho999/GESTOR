import { type NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawPathname = request.nextUrl.searchParams.get('pathname')
  if (!rawPathname) return NextResponse.json({ error: 'Missing pathname' }, { status: 400 })

  const pathname = decodeURIComponent(rawPathname)

  try {
    let blobUrl = pathname

    // 1. Obtener la URL real si solo tenemos el nombre
    if (!pathname.startsWith('http')) {
      const { blobs } = await list({ prefix: pathname, limit: 1 })
      if (!blobs || blobs.length === 0) {
        return new NextResponse('Blob not found', { status: 404 })
      }
      blobUrl = blobs[0].url
    }

    // 2. FETCH MANUAL usando el TOKEN para evitar el 403
    // Esto es lo que permite leer archivos privados desde el servidor
    const response = await fetch(blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    })

    if (!response.ok) {
      console.error(`Error fetch: ${response.status}`)
      throw new Error('Failed to fetch private content')
    }

    // 3. Ahora sí sacamos el buffer
    const arrayBuffer = await response.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error serving PDF:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
