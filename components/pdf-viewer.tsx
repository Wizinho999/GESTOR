'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'
}

interface PdfViewerProps {
  pathname: string
  fileName: string
  onClose: () => void
}

export default function PdfViewer({ pathname, fileName, onClose }: PdfViewerProps) {
  const [pdf, setPdf] = useState<any>(null)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 1. Cargar el documento
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/pdf-view?pathname=${encodeURIComponent(pathname)}`, { credentials: 'same-origin' })
        if (!response.ok) throw new Error('Error al obtener archivo')
        const arrayBuffer = await response.arrayBuffer()
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, disableAutoFetch: true })
        const loadedPdf = await loadingTask.promise
        setPdf(loadedPdf)
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar el PDF.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [pathname])

  // 2. Componente interno para renderizar CADA página
  const PageCanvas = ({ pageNum, pdfDoc, scale }: { pageNum: number, pdfDoc: any, scale: number }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    
    useEffect(() => {
      let cancelled = false
      let renderTask: any = null
      async function render() {
        if (!canvasRef.current || !pdfDoc) return
        const page = await pdfDoc.getPage(pageNum)
        if (cancelled || !canvasRef.current) return
        const canvas = canvasRef.current
        const viewport = page.getViewport({ scale })
        const context = canvas.getContext('2d', { alpha: false })!

        const dpr = window.devicePixelRatio || 1
        canvas.width = viewport.width * dpr
        canvas.height = viewport.height * dpr
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        context.scale(dpr, dpr)

        context.fillStyle = 'white'
        context.fillRect(0, 0, viewport.width, viewport.height)

        renderTask = page.render({ canvasContext: context, viewport })
        await renderTask.promise.catch(() => {})
      }
      render()
      return () => { cancelled = true; renderTask?.cancel() }
    }, [pdfDoc, pageNum, scale])

    return <canvas ref={canvasRef} className="shadow-lg mb-6 bg-white" />
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0b] text-white select-none">
      {/* BARRA SUPERIOR */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#18181b] border-b border-white/10 flex-shrink-0">
        <span className="text-sm font-semibold truncate max-w-[250px]">{fileName}</span>
        
        <div className="flex items-center gap-4 bg-black/20 px-4 py-2 rounded-full border border-white/5">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))}><ZoomOut size={18}/></button>
          <span className="text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))}><ZoomIn size={18}/></button>
        </div>

        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* CONTENEDOR DE PÁGINAS (SCROLL) */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center p-6 bg-[#0f0f0f] custom-scrollbar">
        {loading && (
          <div className="flex flex-col items-center gap-4 mt-32">
            <Loader2 className="animate-spin text-blue-500" size={48} />
            <p className="text-white/60 text-sm">Procesando páginas...</p>
          </div>
        )}

        {error && <div className="mt-32 text-red-400">{error}</div>}

        {!loading && pdf && (
          Array.from({ length: pdf.numPages }, (_, i) => (
            <PageCanvas key={`${pathname}-p-${i + 1}`} pageNum={i + 1} pdfDoc={pdf} scale={scale} />
          ))
        )}
      </div>
    </div>
  )
}
