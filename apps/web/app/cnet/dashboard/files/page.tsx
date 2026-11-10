"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, FileUp, FolderPlus, FolderUp, Search, Upload } from "lucide-react"
import { type RefObject, useId, useRef, useState } from "react"
import { type TransferItem, useTransferStore } from "@/lib/stores/transfers"
import {
  createDir,
  deleteDir,
  listDir,
  renameDir,
  search as searchApi,
  uploadFile,
  uploadFolder,
  type VaultDir,
  type VaultFile,
} from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/stories/dropdown-menu/dropdown-menu"
import { collectDroppedFiles, hasDesktopFiles } from "../_components/dropped-files"
import { FileGrid } from "../_components/file-grid"
import { formatBytes } from "../_components/format"
import { TextDialog, type TextPrompt } from "../_components/text-dialog"
import { useFileViewMode } from "../_components/use-file-view-mode"
import { useVaultFileActions } from "../_components/use-vault-file-actions"
import { ViewModeToggle } from "../_components/view-mode-toggle"

export default function FilesPage() {
  const qc = useQueryClient()
  const [viewMode, setViewMode] = useFileViewMode()
  const [dirId, setDirId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [prompt, setPrompt] = useState<TextPrompt | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false)
  const [dropping, setDropping] = useState(false)
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
  const fileActions = useVaultFileActions()

  async function handleFiles(files: FileList | File[] | null) {
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

  async function handleFolder(
    fileList: FileList | File[] | null,
    relativePath?: (f: File) => string | undefined
  ) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const relOf = (f: File) => relativePath?.(f) || f.webkitRelativePath || f.name
    const transfers = useTransferStore.getState()
    const ids = new WeakMap<File, string>()
    const stamp = Date.now()
    files.forEach((file, i) => {
      const id = `upload:${relOf(file)}-${file.size}-${stamp}-${i}`
      ids.set(file, id)
      transfers.upsert({ id, label: relOf(file), kind: "upload", progress: 0, status: "active" })
    })
    const patch = (file: File, p: Partial<TransferItem>) => {
      const id = ids.get(file)
      if (id) useTransferStore.getState().update(id, p)
    }
    const summaryId = `upload-summary:${stamp}`
    transfers.upsert({
      id: summaryId,
      label: "Folder sync: checking what is already there…",
      kind: "upload",
      progress: 0,
      status: "active",
    })
    try {
      const summary = await uploadFolder(files, dirId, {
        onProgress: (file, frac) => patch(file, { progress: Math.round(frac * 100) }),
        onDone: (file) => patch(file, { progress: 100, status: "completed" }),
        onError: (file, err) =>
          patch(file, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          }),
        // Already there: drop the row rather than leave it stuck at 0%.
        onSkip: (file) => {
          const id = ids.get(file)
          if (id) useTransferStore.getState().remove(id)
        },
        onResume: (file) => patch(file, { label: `${relOf(file)} (resumed)` }),
        relativePath,
        onBytes: (sent, planned) =>
          useTransferStore.getState().update(summaryId, {
            label: `Folder sync: ${formatBytes(sent)} of ${formatBytes(planned)} sent`,
            progress: planned ? Math.round((sent / planned) * 100) : 0,
          }),
      })
      const parts = [
        `${summary.uploaded} uploaded`,
        `${summary.skipped} already there`,
        summary.resumed ? `${summary.resumed} resumed` : null,
        summary.replaced ? `${summary.replaced} replaced` : null,
        summary.failed ? `${summary.failed} failed` : null,
        `${formatBytes(summary.bytes)} sent`,
      ].filter(Boolean)
      transfers.upsert({
        id: summaryId,
        label: `Folder sync: ${parts.join(", ")}`,
        kind: "upload",
        progress: 100,
        status: summary.failed ? "error" : "completed",
        error: summary.failed
          ? "Some files failed; drop the folder again to retry them"
          : undefined,
      })
    } finally {
      invalidate()
      if (folderInputRef.current) folderInputRef.current.value = ""
    }
  }

  // Open the picker synchronously inside the select handler, while the tap's user
  // activation is still live, and only then close the menu ourselves. Letting Radix
  // close it first unmounts the menu before a <label>'s default action runs; Chrome
  // still resolves a detached label's control, WebKit doesn't, so on iOS the label
  // approach opened nothing.
  const openPicker = (input: RefObject<HTMLInputElement | null>) => (event: Event) => {
    event.preventDefault()
    input.current?.click()
    setUploadMenuOpen(false)
  }

  const data = listing.data
  const error = listing.error ?? searchResults.error
  const loading = searching ? searchResults.isLoading : listing.isLoading
  const files: VaultFile[] = searching ? (searchResults.data?.files ?? []) : (data?.files ?? [])
  const directories: VaultDir[] = searching ? [] : (data?.directories ?? [])

  const folderActions = {
    onOpen: (d: VaultDir) => setDirId(d.id),
    onRename: (d: VaultDir, name: string) => renameFolder.mutate({ id: d.id, name }),
    onDelete: (d: VaultDir) => removeFolder.mutate(d.id),
  }
  const newFolder = () =>
    setPrompt({
      title: "New folder",
      initial: "",
      onSubmit: (name) => name.trim() && createFolder.mutate(name.trim()),
    })
  const spaceActions = {
    onNewFolder: newFolder,
    onUpload: () => fileInputRef.current?.click(),
  }

  // Files dragged in from the desktop. dragenter/dragleave fire for every child the
  // pointer crosses, so a depth counter tells a real leave from an internal one.
  const dropDepth = useRef(0)
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasDesktopFiles(e.dataTransfer) || searching) return
    e.preventDefault()
    dropDepth.current += 1
    setDropping(true)
  }
  const onDragLeave = () => {
    dropDepth.current = Math.max(0, dropDepth.current - 1)
    if (dropDepth.current === 0) setDropping(false)
  }
  const onDrop = async (e: React.DragEvent) => {
    if (!hasDesktopFiles(e.dataTransfer)) return
    e.preventDefault()
    dropDepth.current = 0
    setDropping(false)
    const dropped = await collectDroppedFiles(e.dataTransfer)
    if (dropped.files.length === 0) return
    if (dropped.hasDirectories) await handleFolder(dropped.files, (f) => dropped.paths.get(f))
    else await handleFiles(dropped.files)
  }
  const hereLabel = data?.breadcrumbs[data.breadcrumbs.length - 1]?.label ?? "My Vault"

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the page is a drop zone for files from the desktop; the buttons inside remain the keyboard path
    <div
      className="relative w-full"
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (hasDesktopFiles(e.dataTransfer) && !searching) e.preventDefault()
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dropping ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-neutral-90 border-dashed bg-[#faf6f1]/80 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-xl bg-neutral-90 px-5 py-3 text-white shadow-xl">
            <Upload className="h-5 w-5" />
            <span className="font-medium text-sm">Drop to upload into “{hereLabel}”</span>
          </div>
        </div>
      ) : null}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold text-2xl text-neutral-100 md:text-3xl">Files</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={newFolder}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New folder
          </Button>
          {/* One Upload button, two pickers: a native file dialog can select either
              loose files or a directory, never both, so the choice lives in the menu. */}
          <DropdownMenu open={uploadMenuOpen} onOpenChange={setUploadMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button className="flex-1 sm:flex-none">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={openPicker(fileInputRef)}>
                <FileUp className="mr-2 h-4 w-4" />
                Files…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openPicker(folderInputRef)}>
                <FolderUp className="mr-2 h-4 w-4" />
                Folder…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* No `accept` on purpose: the vault stores anything, archives (.zip/.rar)
              included, so narrowing the picker would only hide valid files. */}
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
        // A deep path scrolls sideways on a phone instead of wrapping into a block.
        <div className="mb-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1 text-neutral-70 text-sm">
          {data.breadcrumbs.map((b, i) => (
            <span key={b.directoryId ?? "root"} className="flex shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                data-drop-dir={b.directoryId ?? "root"}
                onClick={() => setDirId(b.directoryId)}
                className="rounded px-1 py-1 hover:text-neutral-100 hover:underline data-[drop-active]:bg-neutral-90 data-[drop-active]:text-white"
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
          spaceActions={spaceActions}
          currentDirId={dirId}
          folderName={data?.directory?.name ?? "My Vault"}
          empty={searching ? "No matching files" : "This folder is empty"}
          viewMode={viewMode}
        />
      )}

      <TextDialog prompt={prompt} onClose={() => setPrompt(null)} />
    </div>
  )
}
