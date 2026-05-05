'use client'

import { useState, useRef } from 'react'
import PdfViewer from './pdf-viewer'
import GlobalSearch from '@/components/global-search'
import {
  renameFolderAction,
  renameFileAction,
  deleteFileAction,
  deleteFolderAction,
  uploadFileAction,
  uploadFolderAction,
  createFolderAction,
} from '@/app/actions/files'

interface Folder {
  id: number
  name: string
  file_count: number | string
  subfolder_count: number | string
  can_manage?: boolean
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

export default function DriveExplorer({ initialFolders, isAdmin }: DriveExplorerProps) {
  const [folderStack, setFolderStack]           = useState<Folder[]>([])
  const [subfolders, setSubfolders]             = useState<Folder[]>([])
  const [files, setFiles]                       = useState<FileItem[]>([])
  const [loading, setLoading]                   = useState(false)
  const [viewingPdf, setViewingPdf]             = useState<{ pathname: string; name: string } | null>(null)
  const [page, setPage]                         = useState(1)
  const [renamingFolder, setRenamingFolder]     = useState<{ id: number; name: string } | null>(null)
  const [renamingFile, setRenamingFile]         = useState<{ id: number; name: string } | null>(null)
  const [renameValue, setRenameValue]           = useState('')
  const [canManageCurrent, setCanManageCurrent] = useState(false)
  const [uploading, setUploading]               = useState(false)
  const [uploadPercent, setUploadPercent]       = useState(0)
  const [uploadMsg, setUploadMsg]               = useState('')
  const [showNewFolder, setShowNewFolder]       = useState(false)
  const [newFolderName, setNewFolderName]       = useState('')

  const renameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

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
      setCanManageCurrent(data.can_manage === true || isAdmin)
    } finally {
      setLoading(false)
    }
  }

  function navigateTo(index: number) {
    if (index < 0) {
      setFolderStack([])
      setFiles([])
      setSubfolders([])
      setCanManageCurrent(false)
      setPage(1)
    } else {
      const newStack = folderStack.slice(0, index + 1)
      setFolderStack(newStack)
      openFolder(newStack[newStack.length - 1], false)
    }
  }

  async function handleRenameFolder(folderId: number, newName: string) {
    if (!newName.trim() || newName === renamingFolder?.name) { setRenamingFolder(null); return }
    await renameFolderAction(folderId, newName.trim())
    const update = (list: Folder[]) => list.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f)
    setSubfolders(update)
    setFolderStack(prev => prev.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f))
    setRenamingFolder(null)
  }

  async function handleRenameFile(fileId: number, newName: string) {
    if (!newName.trim() || newName === renamingFile?.name) { setRenamingFile(null); return }
    await renameFileAction(fileId, newName.trim())
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, name: newName.trim() } : f))
    setRenamingFile(null)
  }

  async function handleDeleteFile(fileId: number) {
    if (!confirm('¿Eliminar este archivo?')) return
    await deleteFileAction(fileId)
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  async function handleDeleteFolder(folderId: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta carpeta y todos sus archivos?')) return
    await deleteFolderAction(folderId)
    setSubfolders(prev => prev.filter(f => f.id !== folderId))
  }

  function startRenameFolder(folder: Folder, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingFolder(folder)
    setRenameValue(folder.name)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  function startRenameFile(file: FileItem, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingFile(file)
    setRenameValue(file.name)
    setTimeout(() => renameInputRef.current?.select(), 50)
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderName.trim() || !selectedFolder) return
    const fd = new FormData()
    fd.set('name', newFolderName.trim())
    fd.set('parent_id', String(selectedFolder.id))
    await createFolderAction(fd)
    setNewFolderName('')
    setShowNewFolder(false)
    await openFolder(selectedFolder, false)
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedFolder) return
    setUploading(true)
    setUploadPercent(0)
    setUploadMsg('Subiendo archivo...')
    const fd = new FormData()
    fd.set('file', file)
    fd.set('folder_id', String(selectedFolder.id))
    await uploadFileAction(fd)
    setUploadMsg('✓ Archivo subido')
    setUploadPercent(100)
    setTimeout(() => { setUploadMsg(''); setUploadPercent(0) }, 2000)
    await openFolder(selectedFolder, false)
    setUploading(false)
    e.target.value = ''
  }

  async function handleUploadFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || !selectedFolder) return
    const pdfs = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) { alert('No se encontraron PDFs'); e.target.value = ''; return }

    setUploading(true)
    setUploadPercent(0)

    let uploaded = 0
    for (let i = 0; i < pdfs.length; i++) {
      const file         = pdfs[i]
      const relativePath = (file as File & { webkitRelativePath: string }).webkitRelativePath || file.name
      const fd           = new FormData()
      fd.append('file_0', file)
      fd.append('path_0', relativePath)
      try { await uploadFolderAction(fd); uploaded++ } catch { /* skip */ }
      setUploadPercent(Math.round(((i + 1) / pdfs.length) * 100))
      setUploadMsg(`${i + 1} / ${pdfs.length} archivos`)
    }

    setUploadMsg(`✓ ${uploaded} archivos subidos`)
    setTimeout(() => { setUploadMsg(''); setUploadPercent(0) }, 2500)
    await openFolder(selectedFolder, false)
    setUploading(false)
    e.target.value = ''
  }

  const currentFolders = selectedFolder ? subfolders : initialFolders

  return (
    <div className="p-4 md:p-8">

      {/* Header */}
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

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            {selectedFolder ? selectedFolder.name : 'Mis Documentos'}
          </h1>

          {/* Botones subida — solo dentro de carpeta con permiso */}
          {selectedFolder && canManageCurrent && (
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUploadFile} />
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                // @ts-expect-error webkitdirectory
                webkitdirectory=""
                multiple
                onChange={handleUploadFolder}
              />
              <button
                onClick={() => setShowNewFolder(true)}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-border text-foreground hover:bg-secondary transition disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nueva carpeta
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'var(--samtech-blue)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Subir PDF
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-border text-foreground hover:bg-secondary transition disabled:opacity-50"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Subir carpeta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="mb-4 rounded-lg border border-border p-3 flex flex-col gap-2" style={{ background: 'rgba(0,100,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: 'var(--samtech-blue)', borderTopColor: 'transparent' }} />
              <span className="text-xs">{uploadMsg}</span>
            </div>
            <span className="text-xs font-semibold text-foreground">{uploadPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,100,255,0.12)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadPercent}%`, background: 'var(--samtech-blue)' }} />
          </div>
        </div>
      )}
      {uploadMsg && !uploading && (
        <div className="mb-4 px-3 py-2 rounded text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
          {uploadMsg}
        </div>
      )}

      {/* Formulario nueva carpeta */}
      {showNewFolder && (
        <form onSubmit={handleCreateFolder} className="mb-4 p-3 rounded-lg border border-border flex items-center gap-3" style={{ background: 'var(--samtech-surface)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <input
            autoFocus type="text" value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nombre de la carpeta"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button type="submit" disabled={!newFolderName.trim()} className="px-3 py-1 rounded text-xs font-semibold text-white disabled:opacity-50" style={{ background: 'var(--samtech-blue)' }}>
            Crear
          </button>
          <button type="button" onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition">
            Cancelar
          </button>
        </form>
      )}

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

          {/* Carpetas */}
          {currentFolders.length > 0 && (
            <div>
              {selectedFolder && subfolders.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Subcarpetas</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {currentFolders.map((folder) => {
                  const folderCanManage = isAdmin || folder.can_manage === true
                  return (
                    <div
                      key={folder.id}
                      className="group relative flex flex-col items-start p-3 md:p-4 rounded-lg border border-border transition-all hover:border-primary cursor-pointer"
                      style={{ background: 'var(--samtech-surface)' }}
                      onClick={() => !renamingFolder && openFolder(folder)}
                    >
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded flex items-center justify-center mb-2 md:mb-3" style={{ background: 'rgba(0,100,255,0.12)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>

                      {renamingFolder?.id === folder.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameFolder(folder.id, renameValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameFolder(folder.id, renameValue)
                            if (e.key === 'Escape') setRenamingFolder(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs font-semibold bg-input border border-ring rounded px-2 py-0.5 text-foreground focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <p className="text-xs md:text-sm font-semibold text-foreground truncate w-full leading-tight">{folder.name}</p>
                      )}

                      <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                        {Number(folder.file_count) === 1 ? '1 archivo' : `${folder.file_count} archivos`}
                        {Number(folder.subfolder_count) > 0 && <span> · {folder.subfolder_count} carpetas</span>}
                      </p>

                      {folderCanManage && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                          <button onClick={(e) => startRenameFolder(folder, e)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary" title="Renombrar">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button onClick={(e) => handleDeleteFolder(folder.id, e)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20" title="Eliminar">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
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
                  <p className="text-muted-foreground text-sm">
                    {canManageCurrent ? 'Carpeta vacía. Sube un PDF o una carpeta.' : 'Esta carpeta está vacía.'}
                  </p>
                </div>
              )}

              {files.length > 0 && (
                <div className="flex flex-col gap-2">
                  {files.slice(0, page * PAGE_SIZE).map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" style={{ background: 'var(--samtech-surface)' }}>
                      <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,60,60,0.12)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        {renamingFile?.id === file.id ? (
                          <input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameFile(file.id, renameValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameFile(file.id, renameValue)
                              if (e.key === 'Escape') setRenamingFile(null)
                            }}
                            className="w-full text-sm font-medium bg-input border border-ring rounded px-2 py-0.5 text-foreground focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString('es-CL')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setViewingPdf({ pathname: file.blob_url, name: file.name })}
                          className="px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                          style={{ background: 'rgba(0,100,255,0.15)', color: 'var(--samtech-blue-bright)' }}
                        >
                          Ver
                        </button>
                        {canManageCurrent && (
                          <>
                            <button
                              onClick={(e) => startRenameFile(file, e)}
                              className="px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                              style={{ background: 'rgba(255,165,0,0.12)', color: '#f59e0b' }}
                            >
                              Renombrar
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                              style={{ background: 'rgba(255,60,60,0.12)', color: '#ff6b6b' }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

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