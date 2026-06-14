"use client"

import { Download, Folder, MoreVertical, Palette, Pencil, Star, Trash2 } from "lucide-react"
import { useState } from "react"
import { type VaultDir, type VaultFile, vaultUrl } from "@/lib/vault-api"
import { FileThumb } from "./file-thumb"
import { colorHex, formatBytes, VAULT_COLORS } from "./format"

export type FileActions = {
  onStar: (f: VaultFile) => void
  onRename: (f: VaultFile) => void
  onDelete: (f: VaultFile) => void
  onColor: (f: VaultFile, color: string | null) => void
}

export type FolderActions = {
  onOpen: (d: VaultDir) => void
  onRename: (d: VaultDir) => void
  onDelete: (d: VaultDir) => void
}

function FolderCard({ dir, actions }: { dir: VaultDir; actions: FolderActions }) {
  return (
    <button
      type="button"
      onDoubleClick={() => actions.onOpen(dir)}
      onClick={() => actions.onOpen(dir)}
      className="group flex items-center gap-3 rounded-xl border border-neutral-30 bg-white px-4 py-3 text-left hover:border-neutral-50 hover:shadow-sm"
    >
      <Folder className="h-6 w-6 shrink-0 text-neutral-70" />
      <span className="flex-1 truncate font-medium text-neutral-100 text-sm">{dir.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          actions.onRename(dir)
        }}
        className="opacity-0 group-hover:opacity-100"
        title="Rename"
      >
        <Pencil className="h-4 w-4 text-neutral-60" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          actions.onDelete(dir)
        }}
        className="opacity-0 group-hover:opacity-100"
        title="Delete"
      >
        <Trash2 className="h-4 w-4 text-neutral-60" />
      </button>
    </button>
  )
}

function FileCard({ file, actions }: { file: VaultFile; actions: FileActions }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const stripe = colorHex(file.color)

  return (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-30 bg-white hover:border-neutral-50 hover:shadow-sm">
      {stripe ? <div className="h-1 w-full" style={{ backgroundColor: stripe }} /> : null}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="flex-1 truncate font-medium text-neutral-100 text-sm"
          title={file.filename}
        >
          {file.filename}
        </span>
        <button type="button" onClick={() => actions.onStar(file)} title="Star">
          <Star
            className={`h-4 w-4 ${file.starred ? "fill-yellow-400 text-yellow-400" : "text-neutral-50"}`}
          />
        </button>
        <button type="button" onClick={() => setMenuOpen((o) => !o)} title="More">
          <MoreVertical className="h-4 w-4 text-neutral-60" />
        </button>
      </div>

      <div className="aspect-[4/3] w-full border-neutral-20 border-t bg-neutral-10">
        <FileThumb file={file} />
      </div>
      <div className="px-3 py-1.5 text-neutral-60 text-xs">{formatBytes(file.size)}</div>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-9 right-2 z-20 w-44 rounded-lg border border-neutral-30 bg-white py-1 shadow-lg">
            <a
              href={vaultUrl(file.downloadUrl)}
              className="flex items-center gap-2 px-3 py-1.5 text-neutral-90 text-sm hover:bg-neutral-10"
            >
              <Download className="h-4 w-4" /> Download
            </a>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                actions.onRename(file)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-neutral-90 text-sm hover:bg-neutral-10"
            >
              <Pencil className="h-4 w-4" /> Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                actions.onDelete(file)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-accent-red-70 text-sm hover:bg-neutral-10"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <div className="flex items-center gap-1.5 border-neutral-20 border-t px-3 py-2">
              <Palette className="h-4 w-4 text-neutral-60" />
              {VAULT_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    setMenuOpen(false)
                    actions.onColor(file, file.color === c.key ? null : c.key)
                  }}
                  className={`h-4 w-4 rounded-full ${file.color === c.key ? "ring-2 ring-neutral-90 ring-offset-1" : ""}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export function FileGrid({
  directories = [],
  files,
  fileActions,
  folderActions,
  empty,
}: {
  directories?: VaultDir[]
  files: VaultFile[]
  fileActions: FileActions
  folderActions?: FolderActions
  empty?: string
}) {
  if (directories.length === 0 && files.length === 0) {
    return <div className="py-16 text-center text-neutral-60">{empty ?? "Nothing here yet"}</div>
  }
  return (
    <div className="space-y-6">
      {directories.length > 0 && folderActions ? (
        <div>
          <p className="mb-2 font-semibold text-neutral-60 text-xs uppercase tracking-wide">
            Folders
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {directories.map((d) => (
              <FolderCard key={d.id} dir={d} actions={folderActions} />
            ))}
          </div>
        </div>
      ) : null}
      {files.length > 0 ? (
        <div>
          {directories.length > 0 && folderActions ? (
            <p className="mb-2 font-semibold text-neutral-60 text-xs uppercase tracking-wide">
              Files
            </p>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {files.map((f) => (
              <FileCard key={f.id} file={f} actions={fileActions} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
