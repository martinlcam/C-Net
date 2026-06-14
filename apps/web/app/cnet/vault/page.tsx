"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, FolderPlus, Search, Upload } from "lucide-react"
import { useId, useRef, useState } from "react"
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
  type VaultDir,
  type VaultFile,
} from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import { FileGrid } from "./_components/file-grid"
import { TextDialog, type TextPrompt } from "./_components/text-dialog"

export default function VaultBrowserPage() {
  const qc = useQueryClient()
  const [dirId, setDirId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [prompt, setPrompt] = useState<TextPrompt | null>(null)
  const [uploads, setUploads] = useState<Record<string, number>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const data = listing.data
  const error = listing.error ?? searchResults.error
  const loading = searching ? searchResults.isLoading : listing.isLoading
  const files: VaultFile[] = searching ? (searchResults.data?.files ?? []) : (data?.files ?? [])
  const directories: VaultDir[] = searching ? [] : (data?.directories ?? [])

  const fileActions = {
    onStar: (f: VaultFile) => (f.starred ? unstar.mutate(f.id) : star.mutate(f.id)),
    onRename: (f: VaultFile) =>
      setPrompt({
        title: "Rename file",
        initial: f.filename,
        onSubmit: (name) => name.trim() && renameF.mutate({ id: f.id, name: name.trim() }),
      }),
    onDelete: (f: VaultFile) => removeF.mutate(f.id),
    onColor: (f: VaultFile, c: string | null) => color.mutate({ id: f.id, c }),
  }
  const folderActions = {
    onOpen: (d: VaultDir) => setDirId(d.id),
    onRename: (d: VaultDir) =>
      setPrompt({
        title: "Rename folder",
        initial: d.name,
        onSubmit: (name) => name.trim() && renameFolder.mutate({ id: d.id, name: name.trim() }),
      }),
    onDelete: (d: VaultDir) => removeFolder.mutate(d.id),
  }

  return (
    <div className="mx-auto max-w-6xl">
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
        <div className="py-16 text-center text-neutral-60">Loading…</div>
      ) : (
        <FileGrid
          directories={directories}
          files={files}
          fileActions={fileActions}
          folderActions={folderActions}
          empty={searching ? "No matching files" : "This folder is empty"}
        />
      )}

      <TextDialog prompt={prompt} onClose={() => setPrompt(null)} />
    </div>
  )
}
