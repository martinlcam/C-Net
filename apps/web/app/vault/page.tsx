"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronRight,
  Download,
  File as FileIcon,
  Folder,
  FolderPlus,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react"
import { useId, useRef, useState } from "react"
import {
  createDir,
  deleteDir,
  deleteFile,
  listDir,
  renameDir,
  renameFile,
  search as searchApi,
  starFile,
  uploadFile,
  type VaultFile,
  vaultUrl,
} from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/stories/dialog/dialog"

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ["KB", "MB", "GB", "TB"]
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

type TextPrompt = { title: string; initial: string; onSubmit: (value: string) => void }

export default function VaultPage() {
  const qc = useQueryClient()
  const [dirId, setDirId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [prompt, setPrompt] = useState<TextPrompt | null>(null)
  const [uploads, setUploads] = useState<Record<string, number>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchId = useId()

  const searching = query.trim().length > 0

  const listingQuery = useQuery({
    queryKey: ["vault", "dir", dirId],
    queryFn: () => listDir(dirId),
    enabled: !searching,
  })
  const searchQuery = useQuery({
    queryKey: ["vault", "search", query.trim()],
    queryFn: () => searchApi(query.trim()),
    enabled: searching,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ["vault", "dir", dirId] })

  const createFolder = useMutation({
    mutationFn: (name: string) => createDir(dirId, name),
    onSuccess: invalidate,
  })
  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameDir(id, name),
    onSuccess: invalidate,
  })
  const removeFolder = useMutation({ mutationFn: deleteDir, onSuccess: invalidate })
  const renameFileM = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFile(id, name),
    onSuccess: invalidate,
  })
  const removeFile = useMutation({ mutationFn: deleteFile, onSuccess: invalidate })
  const star = useMutation({ mutationFn: starFile, onSuccess: invalidate })

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      const key = `${file.name}-${file.size}`
      setUploads((u) => ({ ...u, [key]: 0 }))
      try {
        await uploadFile(file, dirId, (f) => setUploads((u) => ({ ...u, [key]: f })))
      } catch (err) {
        console.error("Upload failed", err)
      } finally {
        setUploads((u) => {
          const next = { ...u }
          delete next[key]
          return next
        })
        invalidate()
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const listing = listingQuery.data
  const error = listingQuery.error ?? searchQuery.error
  const loading = searching ? searchQuery.isLoading : listingQuery.isLoading
  const files: VaultFile[] = searching ? (searchQuery.data?.files ?? []) : (listing?.files ?? [])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-bold text-3xl text-neutral-100">My Vault</h1>
        <div className="flex gap-2">
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
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-neutral-70" />
        <input
          id={searchId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files..."
          className="w-full rounded-md border border-neutral-30 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-neutral-80"
        />
      </div>

      {!searching && listing ? (
        <div className="mb-4 flex flex-wrap items-center gap-1 text-neutral-70 text-sm">
          {listing.breadcrumbs.map((b, i) => (
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

      {Object.keys(uploads).length > 0 && (
        <div className="mb-4 space-y-1">
          {Object.entries(uploads).map(([key, frac]) => (
            <div key={key} className="text-neutral-70 text-xs">
              Uploading {key.split("-")[0]} — {Math.round(frac * 100)}%
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
          {error instanceof Error ? error.message : "Something went wrong"}
        </div>
      ) : loading ? (
        <div className="py-12 text-center text-neutral-70">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-30 bg-white">
          {!searching &&
            listing?.directories.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 border-neutral-20 border-b px-4 py-3 last:border-b-0 hover:bg-neutral-10"
              >
                <button
                  type="button"
                  onClick={() => setDirId(d.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <Folder className="h-5 w-5 text-neutral-80" />
                  <span className="font-medium text-neutral-100">{d.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setPrompt({
                      title: "Rename folder",
                      initial: d.name,
                      onSubmit: (name) =>
                        name.trim() && renameFolder.mutate({ id: d.id, name: name.trim() }),
                    })
                  }
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeFolder.mutate(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 border-neutral-20 border-b px-4 py-3 last:border-b-0 hover:bg-neutral-10"
            >
              <FileIcon className="h-5 w-5 text-neutral-70" />
              <span className="flex-1 truncate text-neutral-100">{f.filename}</span>
              <span className="w-20 text-right text-neutral-70 text-sm">{formatBytes(f.size)}</span>
              <Button variant="ghost" size="icon" onClick={() => star.mutate(f.id)} title="Star">
                <Star className="h-4 w-4" />
              </Button>
              <a href={vaultUrl(f.downloadUrl)} title="Download">
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setPrompt({
                    title: "Rename file",
                    initial: f.filename,
                    onSubmit: (name) =>
                      name.trim() && renameFileM.mutate({ id: f.id, name: name.trim() }),
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => removeFile.mutate(f.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {!loading &&
          files.length === 0 &&
          (searching || (listing?.directories.length ?? 0) === 0) ? (
            <div className="py-12 text-center text-neutral-70">
              {searching ? "No matching files" : "This folder is empty"}
            </div>
          ) : null}
        </div>
      )}

      <TextDialog prompt={prompt} onClose={() => setPrompt(null)} />
    </div>
  )
}

function TextDialog({ prompt, onClose }: { prompt: TextPrompt | null; onClose: () => void }) {
  const [value, setValue] = useState("")
  const inputId = useId()

  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (open && prompt) setValue(prompt.initial)
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prompt?.title}</DialogTitle>
        </DialogHeader>
        <input
          id={inputId}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && prompt) {
              prompt.onSubmit(value)
              onClose()
            }
          }}
          className="w-full rounded-md border border-neutral-30 px-3 py-2 text-sm outline-none focus:border-neutral-80"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (prompt) prompt.onSubmit(value)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
