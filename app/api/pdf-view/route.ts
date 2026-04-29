import { type NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawPathname = request.nextUrl.searchParams.get('pathname')
  if (!rawPathname) return NextResponse.json({ error: 'Missing pathname' }, { status: 400 })

  const pathname = decodeURIComponent(rawPathname)

  try {
    // El pathname viene como "/uploads/pdfs/timestamp-filename.pdf"
    // Necesitamos leerlo desde el disco local
    
    if (!pathname.startsWith('/uploads/pdfs/')) {
      return new NextResponse('Invalid path', { status: 400 })
    }

    // Extraer solo el nombre del archivo
    const filename = pathname.replace('/uploads/pdfs/', '')
    
    // Construir la ruta segura (prevenir path traversal)
    const filePath = join(process.cwd(), 'public', 'uploads', 'pdfs', filename)
    
    // Validar que la ruta está dentro de la carpeta permitida (seguridad)
    const allowedDir = join(process.cwd(), 'public', 'uploads', 'pdfs')
    if (!filePath.startsWith(allowedDir)) {
      return new NextResponse('Unauthorized path', { status: 403 })
    }

    // Leer archivo del disco
    const buffer = await readFile(filePath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error serving PDF:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}