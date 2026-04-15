'use client'

import { useState, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { createFolderAction, uploadFileAction, deleteFolderAction, deleteFileAction } from '@/app/actions/files'

// Import PdfViewer dynamically without SSR to avoid DOMMatrix errors
const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })

interface Folder {
  id: number
  name: string
  file_count: number | string
  uploader_name?: string
  created_at: string
}

interface FileItem {
  id: number
  name: string
  blob_url: string
  size_bytes: number
  uploader_name?: string
  created_at: string
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminFilesManager({ initialFolders }: { initialFolders: Folder[] }) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [viewingPdf, setViewingPdf] = useState<{ pathname: string; name: string } | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  async function loadFolders() {
    const res = await fetch('/api/admin/folders')
    const data = await res.json()
    setFolders(data.folders || [])
  }

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

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!folderName.trim()) return
    const fd = new FormData()
    fd.set('name', folderName.trim())
    startTransition(async () => {
      await createFolderAction(fd)
      setFolderName('')
      setShowNewFolder(false)
      await loadFolders()
    })
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedFolder) return
    setUploading(true)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('folder_id', String(selectedFolder.id))
    await uploadFileAction(fd)
    await openFolder(selectedFolder)
    await loadFolders()
    setUploading(false)
    e.target.value = ''
  }

  async function handleUploadFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || !selectedFolder) return
    setUploading(true)
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue
      const fd = new FormData()
      fd.set('file', file)
      fd.set('folder_id', String(selectedFolder.id))
      await uploadFileAction(fd)
    }
    await openFolder(selectedFolder)
    await loadFolders()
    setUploading(false)
    e.target.value = ''
  }

  async function handleDeleteFolder(folderId: number) {
    if (!confirm('¿Eliminar esta carpeta y todos sus archivos?')) return
    await deleteFolderAction(folderId)
    setFolders((prev) => prev.filter((f) => f.id !== folderId))
    if (selectedFolder?.id === folderId) setSelectedFolder(null)
  }

  async function handleDeleteFile(fileId: number) {
    if (!confirm('¿Eliminar este archivo?')) return
    await deleteFileAction(fileId)
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    await loadFolders()
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <span
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setSelectedFolder(null)}
            >
              Archivos
            </span>
            {selectedFolder && (
              <>
                <span>/</span>
                <span className="text-foreground">{selectedFolder.name}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedFolder ? selectedFolder.name : 'Gestor de Archivos'}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!selectedFolder ? (
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white transition"
              style={{ background: 'var(--samtech-blue)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nueva carpeta
            </button>
          ) : (
            <>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUploadFile} />
              <input ref={folderInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleUploadFolder} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'var(--samtech-blue)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploading ? 'Subiendo...' : 'Subir PDF'}
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition disabled:opacity-50 border border-border text-foreground hover:bg-secondary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Subir carpeta
              </button>
            </>
          )}
        </div>
      </div>

      {/* New folder dialog inline */}
      {showNewFolder && (
        <form
          onSubmit={handleCreateFolder}
          className="mb-6 p-4 rounded-lg border border-border flex items-center gap-3"
          style={{ background: 'var(--samtech-surface)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <input
            autoFocus
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Nombre de la carpeta"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none"
          />
          <button
            type="submit"
            disabled={isPending || !folderName.trim()}
            className="px-3 py-1.5 rounded text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--samtech-blue)' }}
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => { setShowNewFolder(false); setFolderName('') }}
            className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </form>
      )}

      {!selectedFolder ? (
        /* Folder grid */
        <div>
          {folders.length === 0 ? (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--samtech-surface-raised)' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No hay carpetas. Crea una para empezar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="group relative flex flex-col items-start p-4 rounded-lg border border-border transition-all hover:border-primary cursor-pointer"
                  style={{ background: 'var(--samtech-surface)' }}
                  onClick={() => openFolder(folder)}
                >
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center mb-3"
                    style={{ background: 'rgba(0,100,255,0.12)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate w-full">{folder.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Number(folder.file_count) === 1 ? '1 archivo' : `${folder.file_count} archivos`}
                  </p>
                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id) }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded transition-opacity hover:bg-destructive/20"
                    title="Eliminar carpeta"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
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
            Volver a carpetas
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
              <p className="text-muted-foreground text-sm">Carpeta vacía. Sube un PDF para empezar.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden" style={{ background: 'var(--samtech-surface)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">Archivo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Tamaño</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Subido por</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
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
                            </svg>
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[200px]">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatBytes(file.size_bytes)}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{file.uploader_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {new Date(file.created_at).toLocaleDateString('es-CL')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingPdf({ pathname: file.blob_url, name: file.name })}
                            className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                            style={{ background: 'rgba(0,100,255,0.15)', color: 'var(--samtech-blue-bright)' }}
                          >
                            Ver
                          </button>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                            style={{ background: 'rgba(255,60,60,0.12)', color: '#ff6b6b' }}
                          >
                            Eliminar
                          </button>
                        </div>
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
