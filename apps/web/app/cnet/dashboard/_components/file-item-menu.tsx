"use client"

import { Download, MoreVertical, Palette, Pencil, Trash2 } from "lucide-react"
import { type VaultDir, type VaultFile, vaultUrl } from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/stories/dropdown-menu/dropdown-menu"
import type { FileActions, FolderActions } from "./file-actions"
import { VAULT_COLORS } from "./format"

function MenuTrigger() {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="More">
        <MoreVertical className="h-4 w-4 text-neutral-60" />
      </Button>
    </DropdownMenuTrigger>
  )
}

export function FileItemMenu({
  file,
  actions,
  onStartRename,
}: {
  file: VaultFile
  actions: FileActions
  onStartRename: () => void
}) {
  return (
    <DropdownMenu>
      <MenuTrigger />
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem asChild>
          <a href={vaultUrl(file.downloadUrl)} className="flex cursor-default items-center gap-2">
            <Download className="h-4 w-4" />
            Download
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onStartRename}>
          <Pencil className="h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-accent-red-70 focus:text-accent-red-70"
          onSelect={() => actions.onDelete(file)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 font-normal text-neutral-70">
          <Palette className="h-4 w-4" />
          Color
        </DropdownMenuLabel>
        <div className="flex items-center gap-1.5 px-2 pb-2">
          {VAULT_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.label}
              onClick={() => actions.onColor(file, file.color === c.key ? null : c.key)}
              className={`h-4 w-4 rounded-full ${file.color === c.key ? "ring-2 ring-neutral-90 ring-offset-1" : ""}`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FolderItemMenu({
  dir,
  actions,
  onStartRename,
}: {
  dir: VaultDir
  actions: FolderActions
  onStartRename: () => void
}) {
  return (
    <DropdownMenu>
      <MenuTrigger />
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem onSelect={() => actions.onOpen(dir)}>Open</DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onStartRename}>
          <Pencil className="h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-accent-red-70 focus:text-accent-red-70"
          onSelect={() => actions.onDelete(dir)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
