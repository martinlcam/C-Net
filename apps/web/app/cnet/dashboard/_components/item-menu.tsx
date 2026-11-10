"use client"

import {
  CheckSquare,
  Download,
  Eye,
  FolderInput,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Palette,
  Pencil,
  Star,
  Trash2,
  Upload,
} from "lucide-react"
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
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
import type { FileActions, FolderActions, SpaceActions } from "./file-actions"
import { VAULT_COLORS } from "./format"
import { useIsMobile } from "./use-is-mobile"

/** What was right-clicked (or whose ⋮ was pressed). */
export type MenuTarget =
  | { kind: "file"; file: VaultFile }
  | { kind: "files"; files: VaultFile[] }
  | { kind: "folder"; dir: VaultDir }
  | { kind: "space" }

type Point = { x: number; y: number }

type MenuHandlers = {
  fileActions: FileActions
  folderActions?: FolderActions
  spaceActions?: SpaceActions
  onOpen: (f: VaultFile) => void
  onRename: (target: { kind: "file" | "folder"; id: string }) => void
  onMoveFiles: (files: VaultFile[]) => void
  onSelectAll: () => void
  onClearSelection: () => void
  isSelected: (id: string) => boolean
  onToggleSelect: (f: VaultFile) => void
}

type MenuContextValue = {
  /** Open the menu for a target at a screen point (a right-click or a button's corner). */
  open: (target: MenuTarget, at: Point) => void
}

const MenuContext = createContext<MenuContextValue | null>(null)

/**
 * One menu for the whole listing instead of one Radix menu per card: a thousand mounted
 * dropdowns is most of what made a big folder feel slow. Right-click anywhere, or the ⋮
 * button, opens it at that point. Phones get the bottom sheet instead.
 */
export function ItemMenuProvider({
  handlers,
  children,
}: {
  handlers: MenuHandlers
  children: ReactNode
}) {
  const mobile = useIsMobile()
  const [state, setState] = useState<{ target: MenuTarget; at: Point } | null>(null)

  const open = useCallback((target: MenuTarget, at: Point) => setState({ target, at }), [])
  const close = useCallback(() => setState(null), [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <MenuContext.Provider value={value}>
      {children}
      {mobile ? (
        <MobileMenu state={state} handlers={handlers} onClose={close} />
      ) : (
        <DesktopMenu state={state} handlers={handlers} onClose={close} />
      )}
    </MenuContext.Provider>
  )
}

export function useItemMenu(): MenuContextValue {
  const ctx = useContext(MenuContext)
  if (!ctx) throw new Error("useItemMenu needs an ItemMenuProvider above it")
  return ctx
}

/** The ⋮ button on a card or row; opens the shared menu at its own corner. */
export function ItemMenuButton({ target }: { target: MenuTarget }) {
  const { open } = useItemMenu()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 sm:h-8 sm:w-8"
      title="More"
      aria-label="More"
      data-no-marquee
      onClick={(e) => {
        e.stopPropagation()
        const r = e.currentTarget.getBoundingClientRect()
        open(target, { x: r.left, y: r.bottom })
      }}
    >
      <MoreVertical className="h-4 w-4 text-neutral-60" />
    </Button>
  )
}

type Entry =
  | {
      type: "item"
      key: string
      label: string
      icon: ReactNode
      onSelect?: () => void
      href?: string
      download?: string
      destructive?: boolean
    }
  | { type: "colors"; files: VaultFile[] }
  | { type: "separator"; key: string }

function entriesFor(target: MenuTarget, h: MenuHandlers): { title: string; entries: Entry[] } {
  switch (target.kind) {
    case "file": {
      const f = target.file
      return {
        title: f.filename,
        entries: [
          {
            type: "item",
            key: "open",
            label: "Open",
            icon: <Eye className="h-4 w-4" />,
            onSelect: () => h.onOpen(f),
          },
          {
            type: "item",
            key: "select",
            label: h.isSelected(f.id) ? "Deselect" : "Select",
            icon: <CheckSquare className="h-4 w-4" />,
            onSelect: () => h.onToggleSelect(f),
          },
          {
            type: "item",
            key: "download",
            label: "Download",
            icon: <Download className="h-4 w-4" />,
            href: vaultUrl(f.downloadUrl),
            download: f.filename,
          },
          {
            type: "item",
            key: "star",
            label: f.starred ? "Remove star" : "Star",
            icon: (
              <Star className={`h-4 w-4 ${f.starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
            ),
            onSelect: () => h.fileActions.onStar(f),
          },
          {
            type: "item",
            key: "rename",
            label: "Rename",
            icon: <Pencil className="h-4 w-4" />,
            onSelect: () => h.onRename({ kind: "file", id: f.id }),
          },
          {
            type: "item",
            key: "move",
            label: "Move to…",
            icon: <FolderInput className="h-4 w-4" />,
            onSelect: () => h.onMoveFiles([f]),
          },
          { type: "separator", key: "s1" },
          { type: "colors", files: [f] },
          { type: "separator", key: "s2" },
          {
            type: "item",
            key: "delete",
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            onSelect: () => h.fileActions.onDelete(f),
            destructive: true,
          },
        ],
      }
    }
    case "files": {
      const files = target.files
      const n = files.length
      const allStarred = files.every((f) => f.starred)
      return {
        title: `${n} files selected`,
        entries: [
          {
            type: "item",
            key: "star",
            label: allStarred ? `Unstar ${n}` : `Star ${n}`,
            icon: <Star className="h-4 w-4" />,
            onSelect: () =>
              void h.fileActions.onBulk(files, { kind: "star", starred: !allStarred }),
          },
          {
            type: "item",
            key: "move",
            label: `Move ${n} to…`,
            icon: <FolderInput className="h-4 w-4" />,
            onSelect: () => h.onMoveFiles(files),
          },
          { type: "separator", key: "s1" },
          { type: "colors", files },
          { type: "separator", key: "s2" },
          {
            type: "item",
            key: "delete",
            label: `Delete ${n}`,
            icon: <Trash2 className="h-4 w-4" />,
            onSelect: () => void h.fileActions.onBulk(files, { kind: "delete" }),
            destructive: true,
          },
          {
            type: "item",
            key: "clear",
            label: "Clear selection",
            icon: <CheckSquare className="h-4 w-4" />,
            onSelect: h.onClearSelection,
          },
        ],
      }
    }
    case "folder": {
      const d = target.dir
      const fa = h.folderActions
      return {
        title: d.name,
        entries: [
          {
            type: "item",
            key: "open",
            label: "Open",
            icon: <FolderOpen className="h-4 w-4" />,
            onSelect: () => fa?.onOpen(d),
          },
          {
            type: "item",
            key: "rename",
            label: "Rename",
            icon: <Pencil className="h-4 w-4" />,
            onSelect: () => h.onRename({ kind: "folder", id: d.id }),
          },
          { type: "separator", key: "s1" },
          {
            type: "item",
            key: "delete",
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            onSelect: () => fa?.onDelete(d),
            destructive: true,
          },
        ],
      }
    }
    case "space": {
      const entries: Entry[] = []
      if (h.spaceActions?.onNewFolder)
        entries.push({
          type: "item",
          key: "new",
          label: "New folder",
          icon: <FolderPlus className="h-4 w-4" />,
          onSelect: h.spaceActions.onNewFolder,
        })
      if (h.spaceActions?.onUpload)
        entries.push({
          type: "item",
          key: "upload",
          label: "Upload files…",
          icon: <Upload className="h-4 w-4" />,
          onSelect: h.spaceActions.onUpload,
        })
      if (entries.length > 0) entries.push({ type: "separator", key: "s1" })
      entries.push({
        type: "item",
        key: "all",
        label: "Select all",
        icon: <CheckSquare className="h-4 w-4" />,
        onSelect: h.onSelectAll,
      })
      return { title: "This folder", entries }
    }
  }
}

function colorOf(files: VaultFile[]): string | null | undefined {
  const first = files[0]?.color ?? null
  return files.every((f) => (f.color ?? null) === first) ? first : undefined
}

function DesktopMenu({
  state,
  handlers,
  onClose,
}: {
  state: { target: MenuTarget; at: Point } | null
  handlers: MenuHandlers
  onClose: () => void
}) {
  const menu = state ? entriesFor(state.target, handlers) : null
  const setColor = (files: VaultFile[], color: string | null) => {
    if (files.length === 1) handlers.fileActions.onColor(files[0], color)
    else void handlers.fileActions.onBulk(files, { kind: "color", color })
  }
  return (
    <DropdownMenu open={state !== null} onOpenChange={(o) => !o && onClose()}>
      {/* A 1px anchor parked under the pointer, so the menu opens where the click was. */}
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed h-px w-px"
          style={{ left: state?.at.x ?? 0, top: state?.at.y ?? 0 }}
        />
      </DropdownMenuTrigger>
      {menu ? (
        <DropdownMenuContent
          align="start"
          className="w-52"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel className="truncate font-normal text-neutral-60 text-xs">
            {menu.title}
          </DropdownMenuLabel>
          {menu.entries.map((e) => {
            if (e.type === "separator") return <DropdownMenuSeparator key={e.key} />
            if (e.type === "colors") {
              const current = colorOf(e.files)
              return (
                <div key="colors" className="flex items-center gap-1.5 px-2 py-1.5">
                  <Palette className="h-4 w-4 text-neutral-70" />
                  {VAULT_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      title={c.label}
                      aria-label={c.label}
                      onClick={() => {
                        setColor(e.files, current === c.key ? null : c.key)
                        onClose()
                      }}
                      className={`h-4 w-4 rounded-full ${current === c.key ? "ring-2 ring-neutral-90 ring-offset-1" : ""}`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )
            }
            const cls = `gap-2 ${e.destructive ? "text-accent-red-70 focus:text-accent-red-70" : ""}`
            return e.href ? (
              <DropdownMenuItem key={e.key} asChild className={cls}>
                <a
                  href={e.href}
                  download={e.download}
                  className="flex cursor-default items-center gap-2"
                >
                  {e.icon}
                  {e.label}
                </a>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={e.key} className={cls} onSelect={e.onSelect}>
                {e.icon}
                {e.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  )
}

function MobileMenu({
  state,
  handlers,
  onClose,
}: {
  state: { target: MenuTarget; at: Point } | null
  handlers: MenuHandlers
  onClose: () => void
}) {
  const menu = state ? entriesFor(state.target, handlers) : null
  const colorFiles = menu?.entries.find(
    (e): e is Extract<Entry, { type: "colors" }> => e.type === "colors"
  )?.files
  const actions: SheetAction[] = (menu?.entries ?? [])
    .filter((e): e is Extract<Entry, { type: "item" }> => e.type === "item")
    .map((e) => ({
      key: e.key,
      label: e.label,
      icon: e.icon,
      onSelect: e.onSelect,
      href: e.href,
      download: e.download,
      destructive: e.destructive,
    }))
  return (
    <ActionSheet
      open={state !== null}
      onClose={onClose}
      title={menu?.title ?? ""}
      actions={actions}
    >
      {colorFiles ? (
        <div className="flex items-center gap-3 px-3 pt-2 pb-1">
          <Palette className="h-5 w-5 text-neutral-70" />
          <div className="flex items-center gap-3">
            {VAULT_COLORS.map((c) => {
              const current = colorOf(colorFiles)
              return (
                <button
                  key={c.key}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => {
                    onClose()
                    const color = current === c.key ? null : c.key
                    if (colorFiles.length === 1) handlers.fileActions.onColor(colorFiles[0], color)
                    else void handlers.fileActions.onBulk(colorFiles, { kind: "color", color })
                  }}
                  className={`h-7 w-7 rounded-full ${current === c.key ? "ring-2 ring-neutral-90 ring-offset-1" : ""}`}
                  style={{ backgroundColor: c.hex }}
                />
              )
            })}
          </div>
        </div>
      ) : null}
    </ActionSheet>
  )
}
