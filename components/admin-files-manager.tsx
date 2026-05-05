'use client'

import { useState, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import {
  createFolderAction,
  uploadFileAction,
  uploadFolderAction,
  deleteFolderAction,
  deleteFileAction,
  renameFolderAction,
  renameFileAction,
} from '@/app/actions/files'
import GlobalSearch from '@/components/global-search'

const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })

const PAGE_SIZE = 20

interface Folder {
  id: number
  name: string
  parent_id: number | null
  file_count: number | string
  subfolder_count?: number | string
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
  const [folders, setFolders]             = useState<Folder[]>(initialFolders)
  // Stack de navegación: cada elemento es la carpeta actual
  const [folderStack, setFolderStack]     = useState<Folder[]>([])
  const [files, setFiles]                 = useState<FileItem[]>([])
  const [subfolders, setSubfolders]       = useState<Folder[]>([])
  const [loadingFiles, setLoadingFiles]   = useState(false)
  const [viewingPdf, setViewingPdf]       = useState<{ pathname: string; name: string } | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderName, setFolderName]       = useState('')
  const [isPending, startTransition]      = useTransition()
  const [uploading, setUploading]           = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [uploadPercent, setUploadPercent]   = useState(0)
  const [page, setPage]                     = useState(1)
  const [renamingFolder, setRenamingFolder] = useState<{ id: number; name: string } | null>(null)
  const [renamingFile, setRenamingFile]     = useState<{ id: number; name: string } | null>(null)
  const [renameValue, setRenameValue]       = useState('')
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const selectedFolder = folderStack[folderStack.length - 1] ?? null

  // ── Carga carpetas raíz
  async function loadFolders() {
    const res  = await fetch('/api/admin/folders')
    const data = await res.json()
    setFolders(data.folders || [])
  }

  // ── Abre una carpeta (carga sus archivos Y subcarpetas)
  async function openFolder(folder: Folder, pushStack = true) {
    if (pushStack) setFolderStack((prev) => [...prev, folder])
    setLoadingFiles(true)
    setPage(1) // resetear paginación al entrar a carpeta
    try {
      const [filesRes, subfoldersRes] = await Promise.all([
        fetch(`/api/folder-files?folder_id=${folder.id}`),
        fetch(`/api/admin/folders?parent_id=${folder.id}`),
      ])
      const filesData      = await filesRes.json()
      const subfoldersData = await subfoldersRes.json()
      setFiles(filesData.files           || [])
      setSubfolders(subfoldersData.folders || [])
    } finally {
      setLoadingFiles(false)
    }
  }

  // ── Navega a un nivel del breadcrumb
  function navigateTo(index: number) {
    if (index < 0) {
      setFolderStack([])
      setFiles([])
      setSubfolders([])
      setPage(1)
    } else {
      const newStack = folderStack.slice(0, index + 1)
      setFolderStack(newStack)
      openFolder(newStack[newStack.length - 1], false)
    }
  }

  // ── Crear carpeta
  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!folderName.trim()) return
    const fd = new FormData()
    fd.set('name', folderName.trim())
    if (selectedFolder) fd.set('parent_id', String(selectedFolder.id))
    startTransition(async () => {
      await createFolderAction(fd)
      setFolderName('')
      setShowNewFolder(false)
      if (selectedFolder) {
        await openFolder(selectedFolder, false)
      } else {
        await loadFolders()
      }
    })
  }

  // ── Subir PDF individual
  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedFolder) return
    setUploading(true)
    setUploadPercent(0)
    setUploadProgress('Subiendo archivo...')
    const fd = new FormData()
    fd.set('file', file)
    fd.set('folder_id', String(selectedFolder.id))
    await uploadFileAction(fd)
    await openFolder(selectedFolder, false)
    await loadFolders()
    setUploading(false)
    e.target.value = ''
  }

  // ── Subir carpeta completa con subcarpetas + progreso por archivo
  async function handleUploadFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const pdfs = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.pdf'))

    if (pdfs.length === 0) {
      alert('No se encontraron archivos PDF en la carpeta seleccionada.')
      e.target.value = ''
      return
    }

    setUploading(true)
    setUploadPercent(0)
    setUploadProgress(`0 / ${pdfs.length} archivos`)

    // Subir uno por uno para mostrar progreso real
    let uploaded = 0
    let skipped  = 0

    for (let i = 0; i < pdfs.length; i++) {
      const file         = pdfs[i]
      const relativePath = (file as File & { webkitRelativePath: string }).webkitRelativePath || file.name
      const fd           = new FormData()
      fd.append('file_0', file)
      fd.append('path_0', relativePath)

      try {
        const result = await uploadFolderAction(fd)
        if ('success' in result && result.success) uploaded++
        else skipped++
      } catch {
        skipped++
      }

      const percent = Math.round(((i + 1) / pdfs.length) * 100)
      setUploadPercent(percent)
      setUploadProgress(`${i + 1} / ${pdfs.length} archivos`)
    }

    const msg = skipped > 0
      ? `✓ ${uploaded} subidos, ${skipped} omitidos`
      : `✓ ${uploaded} archivos subidos correctamente`
    setUploadProgress(msg)
    setUploadPercent(100)
    setTimeout(() => { setUploadProgress(''); setUploadPercent(0) }, 3000)

    if (selectedFolder) {
      await openFolder(selectedFolder, false)
    } else {
      await loadFolders()
    }

    setUploading(false)
    e.target.value = ''
  }

  async function handleRenameFolder(folderId: number, newName: string) {
    if (!newName.trim() || newName === renamingFolder?.name) { setRenamingFolder(null); return }
    await renameFolderAction(folderId, newName.trim())
    // Actualizar nombre localmente
    const update = (list: Folder[]) => list.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f)
    setFolders(update)
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

  async function handleDeleteFolder(folderId: number) {
    if (!confirm('¿Eliminar esta carpeta y todos sus archivos?')) return
    await deleteFolderAction(folderId)
    if (selectedFolder) {
      await openFolder(selectedFolder, false)
    } else {
      setFolders((prev) => prev.filter((f) => f.id !== folderId))
    }
  }

  async function handleDeleteFile(fileId: number) {
    if (!confirm('¿Eliminar este archivo?')) return
    await deleteFileAction(fileId)
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    await loadFolders()
  }

  // ── Carpetas a mostrar según nivel actual
  const currentFolders = selectedFolder ? subfolders : folders

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 md:mb-8 gap-3">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-muted-foreground text-sm mb-2 flex-wrap">
            <span
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => navigateTo(-1)}
            >
              Archivos
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
          <h1 className="text-2xl font-bold text-foreground">
            {selectedFolder ? selectedFolder.name : 'Gestor de Archivos'}
          </h1>
        </div>

        {/* Botones */}
        <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition border border-border text-foreground hover:bg-secondary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva carpeta
          </button>

          {/* Input PDF individual */}
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleUploadFile} />

          {/* Input carpeta completa — webkitdirectory permite seleccionar toda una carpeta */}
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            // @ts-expect-error — webkitdirectory no está en los tipos de React pero funciona en todos los browsers modernos
            webkitdirectory=""
            multiple
            onChange={handleUploadFolder}
          />

          {selectedFolder && (
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
          )}

          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition disabled:opacity-50 border border-border text-foreground hover:bg-secondary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            {uploading ? uploadProgress || 'Subiendo...' : 'Subir carpeta'}
          </button>
        </div>
      </div>

      {/* Barra de progreso de subida */}
      {uploading && (
        <div className="mb-4 rounded-lg border border-border p-4 flex flex-col gap-2" style={{ background: 'rgba(0,100,255,0.06)' }}>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin flex-shrink-0" style={{ borderColor: 'var(--samtech-blue)', borderTopColor: 'transparent' }} />
              <span>Subiendo archivos...</span>
            </div>
            <span className="font-semibold text-foreground">{uploadPercent}%</span>
          </div>
          {/* Barra */}
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,100,255,0.12)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${uploadPercent}%`, background: 'var(--samtech-blue)' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{uploadProgress}</p>
        </div>
      )}
      {/* Mensaje de éxito tras subida */}
      {uploadProgress && !uploading && (
        <div className="mb-4 px-4 py-2 rounded text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
          {uploadProgress}
        </div>
      )}

      {/* Barra de búsqueda global */}
      <div className="mb-6">
        <GlobalSearch onOpenPdf={(pathname, name) => setViewingPdf({ pathname, name })} />
      </div>

      {/* Formulario nueva carpeta */}
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

      {/* Contenido: subcarpetas + archivos */}
      {loadingFiles ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--samtech-blue)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Subcarpetas */}
          {currentFolders.length > 0 && (
            <div>
              {selectedFolder && <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Subcarpetas</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {currentFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="group relative flex flex-col items-start p-4 rounded-lg border border-border transition-all hover:border-primary cursor-pointer"
                    style={{ background: 'var(--samtech-surface)' }}
                    onClick={() => !renamingFolder && openFolder(folder)}
                  >
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center mb-3"
                      style={{ background: 'rgba(0,100,255,0.12)' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--samtech-blue-bright)" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>

                    {/* Nombre o input de renombrar */}
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
                        className="w-full text-sm font-semibold bg-input border border-ring rounded px-2 py-0.5 text-foreground focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-semibold text-foreground truncate w-full">{folder.name}</p>
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      {Number(folder.file_count) === 1 ? '1 archivo' : `${folder.file_count} archivos`}
                      {Number(folder.subfolder_count) > 0 && <span> · {folder.subfolder_count} carpetas</span>}
                    </p>

                    {/* Botones hover */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button
                        onClick={(e) => startRenameFolder(folder, e)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary"
                        title="Renombrar carpeta"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id) }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/20"
                        title="Eliminar carpeta"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archivos (solo dentro de una carpeta) */}
          {selectedFolder && (
            <div>
              {subfolders.length > 0 && files.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Archivos {files.length > PAGE_SIZE && `(${files.length} total)`}
                  </p>
                </div>
              )}
              {files.length === 0 && subfolders.length === 0 ? (
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
                  <p className="text-muted-foreground text-sm">Carpeta vacía. Sube un PDF o una carpeta.</p>
                </div>
              ) : files.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {files.slice(0, page * PAGE_SIZE).map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border"
                      style={{ background: 'var(--samtech-surface)' }}
                    >
                      <div
                        className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(255,60,60,0.12)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
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
                          {formatBytes(file.size_bytes)}
                          <span className="hidden sm:inline"> · {file.uploader_name || '—'}</span>
                          <span className="hidden md:inline"> · {new Date(file.created_at).toLocaleDateString('es-CL')}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setViewingPdf({ pathname: file.blob_url, name: file.name })}
                          className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                          style={{ background: 'rgba(0,100,255,0.15)', color: 'var(--samtech-blue-bright)' }}
                        >
                          Ver
                        </button>
                        <button
                          onClick={(e) => startRenameFile(file, e)}
                          className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                          style={{ background: 'rgba(255,165,0,0.12)', color: '#f59e0b' }}
                        >
                          Renombrar
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors"
                          style={{ background: 'rgba(255,60,60,0.12)', color: '#ff6b6b' }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Botón cargar más */}
                  {files.length > page * PAGE_SIZE && (
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="w-full py-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      Cargar más ({files.length - page * PAGE_SIZE} restantes)
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Estado vacío en raíz */}
          {!selectedFolder && folders.length === 0 && (
            <div className="text-center py-20">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--samtech-surface-raised)' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No hay carpetas. Crea una o sube una carpeta completa.</p>
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