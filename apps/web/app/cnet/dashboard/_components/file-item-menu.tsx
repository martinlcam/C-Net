"use client"

import { Download, FolderOpen, MoreVertical, Palette, Pencil, Star, Trash2 } from "lucide-react"
import { useState } from "react"
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
import { ActionSheet, type SheetAction } from "./action-sheet"
import type { FileActions, FolderActions } from "./file-actions"
import { VAULT_COLORS } from "./format"
import { useIsMobile } from "./use-is-mobile"

const TRIGGER = "h-9 w-9 shrink-0 sm:h-8 sm:w-8"

function MenuTrigger() {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className={TRIGGER} title="More">
        <MoreVertical className="h-4 w-4 text-neutral-60" />
      </Button>
    </DropdownMenuTrigger>
  )
}

function ColorSwatches({
  file,
  onColor,
  size = "h-4 w-4",
}: {
  file: VaultFile
  onColor: FileActions["onColor"]
  size?: string
}) {
  return (
    <>
      {VAULT_COLORS.map((c) => (
        <button
          key={c.key}
          type="button"
          title={c.label}
          aria-label={c.label}
          onClick={() => onColor(file, file.color === c.key ? null : c.key)}
          className={`${size} rounded-full ${file.color === c.key ? "ring-2 ring-neutral-90 ring-offset-1" : ""}`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </>
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
  const mobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (mobile) {
    const items: SheetAction[] = [
      {
        key: "download",
        label: "Download",
        icon: <Download className="h-5 w-5" />,
        href: vaultUrl(file.downloadUrl),
        download: file.filename,
      },
      {
        key: "star",
        label: file.starred ? "Remove star" : "Star",
        icon: (
          <Star className={`h-5 w-5 ${file.starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
        ),
        onSelect: () => actions.onStar(file),
      },
      {
        key: "rename",
        label: "Rename",
        icon: <Pencil className="h-5 w-5" />,
        onSelect: onStartRename,
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 className="h-5 w-5 text-accent-red-70" />,
        onSelect: () => actions.onDelete(file),
        destructive: true,
      },
    ]
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className={TRIGGER}
          title="More"
          onClick={() => setOpen(true)}
        >
          <MoreVertical className="h-4 w-4 text-neutral-60" />
        </Button>
        <ActionSheet
          open={open}
          onClose={() => setOpen(false)}
          title={file.filename}
          actions={items}
        >
          <div className="flex items-center gap-3 px-3 pt-2 pb-1">
            <Palette className="h-5 w-5 text-neutral-70" />
            <div className="flex items-center gap-3">
              <ColorSwatches file={file} onColor={actions.onColor} size="h-7 w-7" />
            </div>
          </div>
        </ActionSheet>
      </>
    )
  }

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
          <ColorSwatches file={file} onColor={actions.onColor} />
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
  const mobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (mobile) {
    const items: SheetAction[] = [
      {
        key: "open",
        label: "Open",
        icon: <FolderOpen className="h-5 w-5" />,
        onSelect: () => actions.onOpen(dir),
      },
      {
        key: "rename",
        label: "Rename",
        icon: <Pencil className="h-5 w-5" />,
        onSelect: onStartRename,
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 className="h-5 w-5 text-accent-red-70" />,
        onSelect: () => actions.onDelete(dir),
        destructive: true,
      },
    ]
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className={TRIGGER}
          title="More"
          onClick={() => setOpen(true)}
        >
          <MoreVertical className="h-4 w-4 text-neutral-60" />
        </Button>
        <ActionSheet open={open} onClose={() => setOpen(false)} title={dir.name} actions={items} />
      </>
    )
  }

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
