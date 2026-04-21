'use client'

import { useState } from 'react'
import PdfViewer from './pdf-viewer'
import GlobalSearch from '@/components/global-search'

interface Folder {
  id: number
  name: string
  file_count: number | string
  subfolder_count: number | string
  created_at: string
}

interface FileItem {
  id: number
  name: string
  blob_url: string
  size_bytes: number
  created_at: string
}

interface DriveExplorerProps {
  initialFolders: Folder[]
  userId: number
  isAdmin: boolean
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PAGE_SIZE = 20

export default function DriveExplorer({ initialFolders }: DriveExplorerProps) {
  const [folderStack, setFolderStack] = useState<Folder[]>([])
  const [subfolders, setSubfolders]   = useState<Folder[]>([])
  const [files, setFiles]             = useState<FileItem[]>([])
  const [loading, setLoading]         = useState(false)
  const [viewingPdf, setViewingPdf]   = useState<{ pathname: string; name: string } | null>(null)
  const [page, setPage]               = useState(1)

  const selectedFolder = folderStack[folderStack.length - 1] ?? null

  async function openFolder(folder: Folder, pushStack = true) {
    setLoading(true)
    setPage(1)
    if (pushStack) setFolderStack((prev) => [...prev, folder])
    try {
      const res  = await fetch(`/api/folder-files?folder_id=${folder.id}`)
      const data = await res.json()
      setFiles(data.files           || [])
      setSubfolders(data.subfolders || [])
    } finally {
      setLoading(false)
    }
  }

  function navigateTo(index: number) {
    if (index < 0) {
      setFolderStack([])
      setFiles([])
      setSubfolders([])
    } else {
      const newStack = folderStack.slice(0, index + 1)
      setFolderStack(newStack)
      openFolder(newStack[newStack.length - 1], false)
    }
  }

  const currentFolders = selectedFolder ? subfolders : initialFolders

  return (
    <div className="p-4 md:p-8">

      {/* Breadcrumb */}
      <div className="mb-4">
        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-1 flex-wrap">
          <span className="cursor-pointer hover:text-foreground transition-colors" onClick={() => navigateTo(-1)}>
            Mis Documentos
          </span>
          {folderStack.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1">
              <span>/</span>
              <span
                className={`cursor-pointer hover:text-foreground transition-colors ${i === folderStack.length - 1 ? 'text-foreground' : ''}`}
                onClick={() => navigateTo(i)}
              >
                {f.name}
              </span>
            </span>
          ))}
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">
          {selectedFolder ? selectedFolder.name : 'Mis Documentos'}
        </h1>
      </div>

      {/* Búsqueda global */}
      <div className="mb-6">
        <GlobalSearch onOpenPdf={(pathname, name) => setViewingPdf({ pathname, name })} />
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-16 justify-center">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--samtech-blue)', borderTopColor: 'transparent' }} />
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Carpetas / subcarpetas */}
          {currentFolders.length > 0 && (
            <div>
              {selectedFolder && subfolders.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Subcarpetas</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {currentFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => openFolder(folder)}
                    className="group flex flex-col items-start p-3 md:p-4 rounded-lg border border-border text-left transition-all hover:border-primary active:scale-95"
                    style={{ background: 'var(--samtech-surface)' }}
                  >
                    <div
                      className="w-9 h-9 md:w-10 md:h-10 rounded flex items-center justify-center mb-2 md:mb-3"
                      style={{ background: 'rgba(0,100,255,0.12)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <p className="text-xs md:text-sm font-semibold text-foreground truncate w-full leading-tight">{folder.name}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                      {Number(folder.file_count) === 1 ? '1 archivo' : `${folder.file_count} archivos`}
                      {Number(folder.subfolder_count) > 0 && <span> · {folder.subfolder_count} carpetas</span>}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Archivos */}
          {selectedFolder && (
            <div>
              {subfolders.length > 0 && files.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Archivos</p>
              )}

              {files.length === 0 && subfolders.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-sm">Esta carpeta está vacía.</p>
                </div>
              )}

              {files.length > 0 && (
                <div className="flex flex-col gap-2">
                  {files.slice(0, page * PAGE_SIZE).map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border"
                      style={{ background: 'var(--samtech-surface)' }}
                    >
                      {/* Ícono PDF */}
                      <div
                        className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(255,60,60,0.12)' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>

                      {/* Nombre + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString('es-CL')}
                        </p>
                      </div>

                      {/* Botón ver */}
                      <button
                        onClick={() => setViewingPdf({ pathname: file.blob_url, name: file.name })}
                        className="flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                        style={{ background: 'rgba(0,100,255,0.15)', color: 'var(--samtech-blue-bright)' }}
                      >
                        Ver
                      </button>
                    </div>
                  ))}

                  {/* Cargar más */}
                  {files.length > page * PAGE_SIZE && (
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="w-full py-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      Cargar más ({files.length - page * PAGE_SIZE} restantes)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Estado vacío raíz */}
          {!selectedFolder && initialFolders.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-sm">No tienes carpetas asignadas aún.</p>
            </div>
          )}
        </div>
      )}

      {viewingPdf && (
        <PdfViewer
          pathname={viewingPdf.pathname}
          fileName={viewingPdf.name}
          onClose={() => setViewingPdf(null)}
        />
      )}
    </div>
  )
}