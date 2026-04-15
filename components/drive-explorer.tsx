'use client'

import { useState } from 'react'
import PdfViewer from './pdf-viewer'

interface Folder {
  id: number
  name: string
  file_count: number | string
  created_at: string
}

interface FileItem {
  id: number
  name: string
  blob_url: string  // stored as pathname for private blobs
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

export default function DriveExplorer({ initialFolders, userId, isAdmin }: DriveExplorerProps) {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [viewingPdf, setViewingPdf] = useState<{ pathname: string; name: string } | null>(null)

  async function openFolder(folder: Folder) {
    setSelectedFolder(folder)
    setLoadingFiles(true)
    try {
      const res = await fetch(`/api/folder-files?folder_id=${folder.id}`)
      const data = await res.json()
      setFiles(data.files || [])
    } finally {
      setLoadingFiles(false)
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
          <span
            className="cursor-pointer hover:text-foreground transition-colors"
            onClick={() => setSelectedFolder(null)}
          >
            Mis Documentos
          </span>
          {selectedFolder && (
            <>
              <span>/</span>
              <span className="text-foreground">{selectedFolder.name}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground text-balance">
          {selectedFolder ? selectedFolder.name : 'Mis Documentos'}
        </h1>
      </div>

      {!selectedFolder ? (
        /* Folder grid */
        <div>
          {initialFolders.length === 0 ? (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--samtech-surface-raised)' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No tienes carpetas asignadas aún.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {initialFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => openFolder(folder)}
                  className="group flex flex-col items-start p-4 rounded-lg border border-border text-left transition-all hover:border-primary"
                  style={{ background: 'var(--samtech-surface)' }}
                >
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center mb-3 transition-colors group-hover:bg-opacity-30"
                    style={{ background: 'rgba(0,100,255,0.12)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate w-full text-balance">{folder.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Number(folder.file_count) === 1 ? '1 archivo' : `${folder.file_count} archivos`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* File list inside folder */
        <div>
          <button
            onClick={() => setSelectedFolder(null)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Volver
          </button>

          {loadingFiles ? (
            <div className="flex items-center gap-3 py-12 justify-center">
              <div
                className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--samtech-blue)', borderTopColor: 'transparent' }}
              />
              <span className="text-sm text-muted-foreground">Cargando archivos...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--samtech-surface-raised)' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">Esta carpeta no tiene archivos.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'var(--samtech-surface)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">Archivo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Tamaño</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Subido</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, i) => (
                    <tr
                      key={file.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(255,60,60,0.12)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[200px]">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatBytes(file.size_bytes)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {new Date(file.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setViewingPdf({ pathname: file.blob_url, name: file.name })}
                          className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                          style={{
                            background: 'rgba(0,100,255,0.15)',
                            color: 'var(--samtech-blue-bright)',
                          }}
                        >
                          Ver PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
