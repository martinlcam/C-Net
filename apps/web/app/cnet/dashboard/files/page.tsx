"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, FolderPlus, FolderUp, Search, Upload } from "lucide-react"
import { useId, useRef, useState } from "react"
import { type TransferItem, useTransferStore } from "@/lib/stores/transfers"
import {
  createDir,
  deleteDir,
  deleteFile,
  listDir,
  renameDir,
  renameFile,
  search as searchApi,
  setFileColor,
  starFile,
  unstarFile,
  uploadFile,
  uploadFolder,
  type VaultDir,
  type VaultFile,
} from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import { FileGrid } from "../_components/file-grid"
import { TextDialog, type TextPrompt } from "../_components/text-dialog"
import { useFileViewMode } from "../_components/use-file-view-mode"
import { ViewModeToggle } from "../_components/view-mode-toggle"

export default function FilesPage() {
  const qc = useQueryClient()
  const [viewMode, setViewMode] = useFileViewMode()
  const [dirId, setDirId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [prompt, setPrompt] = useState<TextPrompt | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const searchId = useId()

  const searching = query.trim().length > 0

  const listing = useQuery({
    queryKey: ["vault", "dir", dirId],
    queryFn: () => listDir(dirId),
    enabled: !searching,
  })
  const searchResults = useQuery({
    queryKey: ["vault", "search", query.trim()],
    queryFn: () => searchApi(query.trim()),
    enabled: searching,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vault"] })
  const onSuccess = invalidate

  const createFolder = useMutation({
    mutationFn: (name: string) => createDir(dirId, name),
    onSuccess,
  })
  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameDir(id, name),
    onSuccess,
  })
  const removeFolder = useMutation({ mutationFn: deleteDir, onSuccess })
  const renameF = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFile(id, name),
    onSuccess,
  })
  const removeF = useMutation({ mutationFn: deleteFile, onSuccess })
  const star = useMutation({ mutationFn: starFile, onSuccess })
  const unstar = useMutation({ mutationFn: unstarFile, onSuccess })
  const color = useMutation({
    mutationFn: ({ id, c }: { id: string; c: string | null }) => setFileColor(id, c),
    onSuccess,
  })

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const transfers = useTransferStore.getState()
    for (const file of Array.from(files)) {
      const id = `upload:${file.name}-${file.size}-${Date.now()}`
      transfers.upsert({ id, label: file.name, kind: "upload", progress: 0, status: "active" })
      try {
        await uploadFile(file, dirId, (frac) =>
          useTransferStore.getState().update(id, { progress: Math.round(frac * 100) })
        )
        useTransferStore.getState().update(id, { progress: 100, status: "completed" })
      } catch (err) {
        useTransferStore.getState().update(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        })
      } finally {
        invalidate()
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleFolder(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const transfers = useTransferStore.getState()
    const ids = new WeakMap<File, string>()
    const stamp = Date.now()
    files.forEach((file, i) => {
      const id = `upload:${file.webkitRelativePath || file.name}-${file.size}-${stamp}-${i}`
      ids.set(file, id)
      const label = file.webkitRelativePath || file.name
      transfers.upsert({ id, label, kind: "upload", progress: 0, status: "active" })
    })
    const patch = (file: File, p: Partial<TransferItem>) => {
      const id = ids.get(file)
      if (id) useTransferStore.getState().update(id, p)
    }
    try {
      await uploadFolder(files, dirId, {
        onProgress: (file, frac) => patch(file, { progress: Math.round(frac * 100) }),
        onDone: (file) => patch(file, { progress: 100, status: "completed" }),
        onError: (file, err) =>
          patch(file, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          }),
      })
    } finally {
      invalidate()
      if (folderInputRef.current) folderInputRef.current.value = ""
    }
  }

  const data = listing.data
  const error = listing.error ?? searchResults.error
  const loading = searching ? searchResults.isLoading : listing.isLoading
  const files: VaultFile[] = searching ? (searchResults.data?.files ?? []) : (data?.files ?? [])
  const directories: VaultDir[] = searching ? [] : (data?.directories ?? [])

  const fileActions = {
    onStar: (f: VaultFile) => (f.starred ? unstar.mutate(f.id) : star.mutate(f.id)),
    onRename: (f: VaultFile, name: string) => renameF.mutate({ id: f.id, name }),
    onDelete: (f: VaultFile) => removeF.mutate(f.id),
    onColor: (f: VaultFile, c: string | null) => color.mutate({ id: f.id, c }),
  }
  const folderActions = {
    onOpen: (d: VaultDir) => setDirId(d.id),
    onRename: (d: VaultDir, name: string) => renameFolder.mutate({ id: d.id, name }),
    onDelete: (d: VaultDir) => removeFolder.mutate(d.id),
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold text-2xl text-neutral-100 md:text-3xl">Files</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setPrompt({
                title: "New folder",
                initial: "",
                onSubmit: (name) => name.trim() && createFolder.mutate(name.trim()),
              })
            }
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New folder
          </Button>
          <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
            <FolderUp className="mr-2 h-4 w-4" />
            Upload folder
          </Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // Non-standard directory-picker attributes; let the browser walk the
            // selected folder recursively and hand us every nested file.
            // @ts-expect-error webkitdirectory/directory aren't in React's input typings
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => handleFolder(e.target.files)}
          />
        </div>
      </div>

      <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-neutral-70" />
          <input
            id={searchId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full rounded-md border border-neutral-30 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-neutral-80"
          />
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {!searching && data ? (
        <div className="mb-4 flex flex-wrap items-center gap-1 text-neutral-70 text-sm">
          {data.breadcrumbs.map((b, i) => (
            <span key={b.directoryId ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                onClick={() => setDirId(b.directoryId)}
                className="hover:text-neutral-100 hover:underline"
              >
                {b.label}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
          {error instanceof Error ? error.message : "Something went wrong"}
        </div>
      ) : loading ? (
        <div className="py-16 text-center text-neutral-60">Loading…</div>
      ) : (
        <FileGrid
          directories={directories}
          files={files}
          fileActions={fileActions}
          folderActions={folderActions}
          empty={searching ? "No matching files" : "This folder is empty"}
          viewMode={viewMode}
        />
      )}

      <TextDialog prompt={prompt} onClose={() => setPrompt(null)} />
    </div>
  )
}
