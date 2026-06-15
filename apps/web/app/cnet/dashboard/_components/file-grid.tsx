"use client"

import { Folder, Star } from "lucide-react"
import { useState } from "react"
import type { VaultDir, VaultFile } from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import type { FileActions, FolderActions, RenameTarget } from "./file-actions"
import { FileItemMenu, FolderItemMenu } from "./file-item-menu"
import { FileThumb } from "./file-thumb"
import { colorHex, formatBytes } from "./format"
import { InlineNameEdit } from "./inline-name-edit"
import type { FileViewMode } from "./view-mode-toggle"

export type { FileActions, FolderActions } from "./file-actions"

function StarButton({ file, onStar }: { file: VaultFile; onStar: (f: VaultFile) => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={() => onStar(file)}
      title="Star"
    >
      <Star
        className={`h-4 w-4 ${file.starred ? "fill-yellow-400 text-yellow-400" : "text-neutral-50"}`}
      />
    </Button>
  )
}

function FolderGridCard({
  dir,
  actions,
  renaming,
  onStartRename,
  onCancelRename,
}: {
  dir: VaultDir
  actions: FolderActions
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-30 bg-white px-4 py-3 hover:border-neutral-50 hover:shadow-sm">
      <Folder className="h-6 w-6 shrink-0 text-neutral-70" />
      {renaming ? (
        <InlineNameEdit
          initial={dir.name}
          onSubmit={(name) => {
            actions.onRename(dir, name)
            onCancelRename()
          }}
          onCancel={onCancelRename}
        />
      ) : (
        <button
          type="button"
          onDoubleClick={() => actions.onOpen(dir)}
          onClick={() => actions.onOpen(dir)}
          className="min-w-0 flex-1 truncate text-left font-medium text-neutral-100 text-sm"
        >
          {dir.name}
        </button>
      )}
      <FolderItemMenu dir={dir} actions={actions} onStartRename={onStartRename} />
    </div>
  )
}

function FolderListRow({
  dir,
  actions,
  renaming,
  onStartRename,
  onCancelRename,
}: {
  dir: VaultDir
  actions: FolderActions
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-10">
      <Folder className="h-5 w-5 shrink-0 text-neutral-70" />
      {renaming ? (
        <InlineNameEdit
          initial={dir.name}
          onSubmit={(name) => {
            actions.onRename(dir, name)
            onCancelRename()
          }}
          onCancel={onCancelRename}
          className="flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => actions.onOpen(dir)}
          className="min-w-0 flex-1 truncate text-left font-medium text-neutral-100 text-sm"
        >
          {dir.name}
        </button>
      )}
      <FolderItemMenu dir={dir} actions={actions} onStartRename={onStartRename} />
    </div>
  )
}

function FileGridCard({
  file,
  actions,
  renaming,
  onStartRename,
  onCancelRename,
}: {
  file: VaultFile
  actions: FileActions
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
}) {
  const stripe = colorHex(file.color)

  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-30 bg-white hover:border-neutral-50 hover:shadow-sm">
      {stripe ? <div className="h-1 w-full" style={{ backgroundColor: stripe }} /> : null}
      <div className="flex items-center gap-2 px-3 py-2">
        {renaming ? (
          <InlineNameEdit
            initial={file.filename}
            onSubmit={(name) => {
              actions.onRename(file, name)
              onCancelRename()
            }}
            onCancel={onCancelRename}
          />
        ) : (
          <span
            className="min-w-0 flex-1 truncate font-medium text-neutral-100 text-sm"
            title={file.filename}
          >
            {file.filename}
          </span>
        )}
        <StarButton file={file} onStar={actions.onStar} />
        <FileItemMenu file={file} actions={actions} onStartRename={onStartRename} />
      </div>

      <div className="aspect-[4/3] w-full border-neutral-20 border-t bg-neutral-10">
        <FileThumb file={file} />
      </div>
      <div className="px-3 py-1.5 text-neutral-60 text-xs">{formatBytes(file.size)}</div>
    </div>
  )
}

function FileListRow({
  file,
  actions,
  renaming,
  onStartRename,
  onCancelRename,
}: {
  file: VaultFile
  actions: FileActions
  renaming: boolean
  onStartRename: () => void
  onCancelRename: () => void
}) {
  const stripe = colorHex(file.color)

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-10"
      style={stripe ? { boxShadow: `inset 3px 0 0 0 ${stripe}` } : undefined}
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-neutral-20 bg-neutral-10">
        <FileThumb file={file} />
      </div>
      <div className="min-w-0 flex-1">
        {renaming ? (
          <InlineNameEdit
            initial={file.filename}
            onSubmit={(name) => {
              actions.onRename(file, name)
              onCancelRename()
            }}
            onCancel={onCancelRename}
            className="w-full"
          />
        ) : (
          <>
            <div className="truncate font-medium text-neutral-100 text-sm" title={file.filename}>
              {file.filename}
            </div>
            <div className="text-neutral-60 text-xs">{formatBytes(file.size)}</div>
          </>
        )}
      </div>
      <StarButton file={file} onStar={actions.onStar} />
      <FileItemMenu file={file} actions={actions} onStartRename={onStartRename} />
    </div>
  )
}

export function FileGrid({
  directories = [],
  files,
  fileActions,
  folderActions,
  empty,
  viewMode = "grid",
}: {
  directories?: VaultDir[]
  files: VaultFile[]
  fileActions: FileActions
  folderActions?: FolderActions
  empty?: string
  viewMode?: FileViewMode
}) {
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null)

  if (directories.length === 0 && files.length === 0) {
    return <div className="py-16 text-center text-neutral-60">{empty ?? "Nothing here yet"}</div>
  }

  const isList = viewMode === "list"
  const cancelRename = () => setRenameTarget(null)

  return (
    <div className="space-y-6">
      {directories.length > 0 && folderActions ? (
        <div>
          <p className="mb-2 font-semibold text-neutral-60 text-xs uppercase tracking-wide">
            Folders
          </p>
          {isList ? (
            <div className="overflow-hidden rounded-xl border border-neutral-30 bg-white divide-y divide-neutral-30">
              {directories.map((d) => (
                <FolderListRow
                  key={d.id}
                  dir={d}
                  actions={folderActions}
                  renaming={renameTarget?.kind === "folder" && renameTarget.id === d.id}
                  onStartRename={() => {
                    requestAnimationFrame(() => setRenameTarget({ kind: "folder", id: d.id }))
                  }}
                  onCancelRename={cancelRename}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {directories.map((d) => (
                <FolderGridCard
                  key={d.id}
                  dir={d}
                  actions={folderActions}
                  renaming={renameTarget?.kind === "folder" && renameTarget.id === d.id}
                  onStartRename={() => {
                    requestAnimationFrame(() => setRenameTarget({ kind: "folder", id: d.id }))
                  }}
                  onCancelRename={cancelRename}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
      {files.length > 0 ? (
        <div>
          {directories.length > 0 && folderActions ? (
            <p className="mb-2 font-semibold text-neutral-60 text-xs uppercase tracking-wide">
              Files
            </p>
          ) : null}
          {isList ? (
            <div className="overflow-hidden rounded-xl border border-neutral-30 bg-white divide-y divide-neutral-30">
              {files.map((f) => (
                <FileListRow
                  key={f.id}
                  file={f}
                  actions={fileActions}
                  renaming={renameTarget?.kind === "file" && renameTarget.id === f.id}
                  onStartRename={() => {
                    requestAnimationFrame(() => setRenameTarget({ kind: "file", id: f.id }))
                  }}
                  onCancelRename={cancelRename}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
              {files.map((f) => (
                <FileGridCard
                  key={f.id}
                  file={f}
                  actions={fileActions}
                  renaming={renameTarget?.kind === "file" && renameTarget.id === f.id}
                  onStartRename={() => {
                    requestAnimationFrame(() => setRenameTarget({ kind: "file", id: f.id }))
                  }}
                  onCancelRename={cancelRename}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
