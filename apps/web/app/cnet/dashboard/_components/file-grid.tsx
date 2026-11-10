"use client"

import { Check, Folder, Star } from "lucide-react"
import {
  memo,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { VaultDir, VaultFile } from "@/lib/vault-api"
import type { BulkOp, FileActions, FolderActions, RenameTarget, SpaceActions } from "./file-actions"
import { FilePreviewModal } from "./file-preview-modal"
import { FileThumb } from "./file-thumb"
import { FolderPickerDialog } from "./folder-picker-dialog"
import { colorHex, formatBytes } from "./format"
import { InlineNameEdit } from "./inline-name-edit"
import { ItemMenuButton, ItemMenuProvider, type MenuTarget, useItemMenu } from "./item-menu"
import {
  DRAG_THRESHOLD_PX,
  marqueeSelection,
  type Rect,
  rangeBetween,
  rectFromPoints,
  toggleId,
} from "./selection"
import { SelectionBar } from "./selection-bar"
import type { FileViewMode } from "./view-mode-toggle"

export type { FileActions, FolderActions } from "./file-actions"

// Two columns on a phone; above that as many cards as fit, so a wide screen gets more and
// larger tiles rather than a capped column in the middle.
const GRID =
  "grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-3 2xl:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] 2xl:gap-4"
// Cards off screen skip layout and paint; the placeholder height keeps the scrollbar honest.
const CARD_VIS = "[content-visibility:auto] [contain-intrinsic-size:auto_300px]"
const ROW_VIS = "[content-visibility:auto] [contain-intrinsic-size:auto_60px]"

type FileCardEvents = {
  onOpen: (file: VaultFile) => void
  /** A plain click on the name or picture; the grid decides between open and select. */
  onPrimary: (file: VaultFile, e: React.MouseEvent) => void
  onToggle: (file: VaultFile, e?: React.MouseEvent) => void
  onContext: (target: MenuTarget, e: React.MouseEvent) => void
}

function SelectBox({
  file,
  selected,
  onToggle,
  className,
}: {
  file: VaultFile
  selected: boolean
  onToggle: (file: VaultFile, e?: React.MouseEvent) => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={selected ? `Deselect ${file.filename}` : `Select ${file.filename}`}
      data-no-marquee
      onClick={(e) => {
        e.stopPropagation()
        onToggle(file, e)
      }}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-[opacity,background-color,border-color] ${
        selected
          ? "border-neutral-90 bg-neutral-90 text-white opacity-100"
          : "border-neutral-50 bg-white/90 text-transparent opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      } ${className ?? ""}`}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </button>
  )
}

function StarMark({ file }: { file: VaultFile }) {
  if (!file.starred) return null
  return <Star aria-label="Starred" className="h-3 w-3 fill-yellow-400 text-yellow-400" />
}

const FolderGridCard = memo(function FolderGridCard({
  dir,
  actions,
  renaming,
  onCancelRename,
  onContext,
}: {
  dir: VaultDir
  actions: FolderActions
  renaming: boolean
  onCancelRename: () => void
  onContext: (target: MenuTarget, e: React.MouseEvent) => void
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the card forwards a right-click to the shared menu; its controls are buttons
    <div
      onContextMenu={(e) => onContext({ kind: "folder", dir }, e)}
      className="flex items-center gap-3 rounded-xl border border-neutral-30 bg-white px-4 py-3 hover:border-neutral-50 hover:shadow-sm"
    >
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
          onClick={() => actions.onOpen(dir)}
          className="min-w-0 flex-1 truncate text-left font-medium text-neutral-100 text-sm"
        >
          {dir.name}
        </button>
      )}
      <ItemMenuButton target={{ kind: "folder", dir }} />
    </div>
  )
})

const FolderListRow = memo(function FolderListRow({
  dir,
  actions,
  renaming,
  onCancelRename,
  onContext,
}: {
  dir: VaultDir
  actions: FolderActions
  renaming: boolean
  onCancelRename: () => void
  onContext: (target: MenuTarget, e: React.MouseEvent) => void
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row forwards a right-click to the shared menu; its controls are buttons
    <div
      onContextMenu={(e) => onContext({ kind: "folder", dir }, e)}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-10"
    >
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
      <ItemMenuButton target={{ kind: "folder", dir }} />
    </div>
  )
})

const FileGridCard = memo(function FileGridCard({
  file,
  actions,
  renaming,
  selected,
  onCancelRename,
  events,
}: {
  file: VaultFile
  actions: FileActions
  renaming: boolean
  selected: boolean
  onCancelRename: () => void
  events: FileCardEvents
}) {
  const stripe = colorHex(file.color)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the card forwards a right-click to the shared menu; its controls are buttons
    <div
      data-file-id={file.id}
      data-selected={selected || undefined}
      onContextMenu={(e) => events.onContext({ kind: "file", file }, e)}
      className={`group relative overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] ${CARD_VIS} ${
        selected
          ? "border-neutral-90 shadow-[0_0_0_2px_rgb(23_23_23)]"
          : "border-neutral-30 hover:border-neutral-50 hover:shadow-sm"
      }`}
    >
      {stripe ? <div className="h-1 w-full" style={{ backgroundColor: stripe }} /> : null}
      <div className="flex items-center gap-1 px-2 py-1 sm:gap-2 sm:px-3 sm:py-2">
        <SelectBox file={file} selected={selected} onToggle={events.onToggle} />
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
          <button
            type="button"
            onClick={(e) => events.onPrimary(file, e)}
            className="min-w-0 flex-1 truncate text-left font-medium text-neutral-100 text-xs hover:underline sm:text-sm"
            title={file.filename}
          >
            {file.filename}
          </button>
        )}
        <ItemMenuButton target={{ kind: "file", file }} />
      </div>

      <button
        type="button"
        onClick={(e) => events.onPrimary(file, e)}
        className="block aspect-square w-full cursor-pointer border-neutral-20 border-t bg-neutral-10 sm:aspect-[4/3]"
        title={`Preview ${file.filename}`}
      >
        <FileThumb file={file} />
      </button>
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-neutral-60 text-xs sm:px-3">
        <StarMark file={file} />
        {formatBytes(file.size)}
      </div>
    </div>
  )
})

const FileListRow = memo(function FileListRow({
  file,
  actions,
  renaming,
  selected,
  onCancelRename,
  events,
}: {
  file: VaultFile
  actions: FileActions
  renaming: boolean
  selected: boolean
  onCancelRename: () => void
  events: FileCardEvents
}) {
  const stripe = colorHex(file.color)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row forwards a right-click to the shared menu; its controls are buttons
    <div
      data-file-id={file.id}
      data-selected={selected || undefined}
      onContextMenu={(e) => events.onContext({ kind: "file", file }, e)}
      className={`group flex items-center gap-3 px-3 py-2.5 ${ROW_VIS} ${
        selected ? "bg-neutral-10" : "hover:bg-neutral-10"
      }`}
      style={stripe ? { boxShadow: `inset 3px 0 0 0 ${stripe}` } : undefined}
    >
      <SelectBox file={file} selected={selected} onToggle={events.onToggle} />
      <button
        type="button"
        onClick={(e) => events.onPrimary(file, e)}
        className="h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-neutral-20 bg-neutral-10 sm:h-10 sm:w-10"
        title={`Preview ${file.filename}`}
      >
        <FileThumb file={file} />
      </button>
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
            <button
              type="button"
              onClick={(e) => events.onPrimary(file, e)}
              className="block max-w-full truncate text-left font-medium text-neutral-100 text-sm hover:underline"
              title={file.filename}
            >
              {file.filename}
            </button>
            <div className="flex items-center gap-1.5 text-neutral-60 text-xs">
              <StarMark file={file} />
              {formatBytes(file.size)}
            </div>
          </>
        )}
      </div>
      <ItemMenuButton target={{ kind: "file", file }} />
    </div>
  )
})

type Props = {
  directories?: VaultDir[]
  files: VaultFile[]
  fileActions: FileActions
  folderActions?: FolderActions
  spaceActions?: SpaceActions
  /** Folder being viewed; the move picker opens there. */
  currentDirId?: string | null
  empty?: string
  viewMode?: FileViewMode
}

export function FileGrid(props: Props) {
  const { directories = [], files, fileActions, folderActions, spaceActions, currentDirId } = props
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null)
  const [previewFile, setPreviewFile] = useState<VaultFile | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const anchorRef = useRef<string | null>(null)
  const [moveFiles, setMoveFiles] = useState<VaultFile[] | null>(null)
  const [busy, setBusy] = useState(false)

  const byId = useMemo(() => new Map(files.map((f) => [f.id, f])), [files])
  const order = useMemo(() => files.map((f) => f.id), [files])
  const selectedFiles = useMemo(() => files.filter((f) => selected.has(f.id)), [files, selected])

  // Files that left the listing (deleted, moved, filtered) leave the selection too.
  useEffect(() => {
    setSelected((cur) => {
      const next = new Set([...cur].filter((id) => byId.has(id)))
      return next.size === cur.size ? cur : next
    })
  }, [byId])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    anchorRef.current = null
  }, [])
  const selectAll = useCallback(() => setSelected(new Set(order)), [order])

  const toggle = useCallback(
    (file: VaultFile, e?: React.MouseEvent) => {
      if (e?.shiftKey) {
        setSelected((cur) => new Set([...cur, ...rangeBetween(order, anchorRef.current, file.id)]))
      } else {
        setSelected((cur) => toggleId(cur, file.id))
      }
      anchorRef.current = file.id
    },
    [order]
  )

  const open = useCallback((file: VaultFile) => setPreviewFile(file), [])

  // A plain click opens the file unless a selection is underway, then it joins the selection.
  const primary = useCallback(
    (file: VaultFile, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || selected.size > 0) toggle(file, e)
      else open(file)
    },
    [selected.size, toggle, open]
  )

  const runBulk = useCallback(
    async (op: BulkOp, target = selectedFiles) => {
      setBusy(true)
      try {
        await fileActions.onBulk(target, op)
      } finally {
        setBusy(false)
        if (op.kind === "delete" || op.kind === "move") clearSelection()
      }
    },
    [fileActions, selectedFiles, clearSelection]
  )

  const handlers = useMemo(
    () => ({
      fileActions,
      folderActions,
      spaceActions,
      onOpen: open,
      onRename: (t: { kind: "file" | "folder"; id: string }) => {
        // Let the menu close and release focus before the name field takes it.
        requestAnimationFrame(() => setRenameTarget(t))
      },
      onMoveFiles: (fs: VaultFile[]) => setMoveFiles(fs),
      onSelectAll: selectAll,
      onClearSelection: clearSelection,
      isSelected: (id: string) => selected.has(id),
      onToggleSelect: (f: VaultFile) => toggle(f),
    }),
    [fileActions, folderActions, spaceActions, open, selectAll, clearSelection, selected, toggle]
  )

  // Escape drops the selection; Ctrl/Cmd+A takes every file, unless something else owns the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.defaultPrevented) return
      if (document.querySelector("[role=dialog][data-state=open], [role=menu][data-state=open]"))
        return
      if (e.key === "Escape" && selected.size > 0) {
        e.preventDefault()
        clearSelection()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && order.length > 0) {
        e.preventDefault()
        selectAll()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected.size, order.length, clearSelection, selectAll])

  if (directories.length === 0 && files.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-60">{props.empty ?? "Nothing here yet"}</div>
    )
  }

  return (
    <ItemMenuProvider handlers={handlers}>
      <Listing
        {...props}
        directories={directories}
        selected={selected}
        selectedFiles={selectedFiles}
        renameTarget={renameTarget}
        onCancelRename={() => setRenameTarget(null)}
        onSelectionChange={setSelected}
        events={{ onOpen: open, onPrimary: primary, onToggle: toggle }}
      />
      <SelectionBar
        files={selectedFiles}
        busy={busy}
        onBulk={(op) => void runBulk(op)}
        onMove={() => setMoveFiles(selectedFiles)}
        onClear={clearSelection}
      />
      <FolderPickerDialog
        open={moveFiles !== null}
        title={
          moveFiles && moveFiles.length === 1
            ? `Move “${moveFiles[0].filename}”`
            : `Move ${moveFiles?.length ?? 0} files`
        }
        confirmLabel="Move to"
        startIn={currentDirId ?? null}
        onClose={() => setMoveFiles(null)}
        onPick={(dirId) => {
          const target = moveFiles ?? []
          setMoveFiles(null)
          if (target.length === 1 && selected.size <= 1) fileActions.onMove(target[0], dirId)
          else void runBulk({ kind: "move", directoryId: dirId }, target)
        }}
      />
      <FilePreviewModal file={previewFile} siblings={files} onClose={() => setPreviewFile(null)} />
    </ItemMenuProvider>
  )
}

type ListingProps = Props & {
  directories: VaultDir[]
  selected: ReadonlySet<string>
  selectedFiles: VaultFile[]
  renameTarget: RenameTarget
  onCancelRename: () => void
  onSelectionChange: (next: Set<string>) => void
  events: Omit<FileCardEvents, "onContext">
}

/** The cards themselves, plus the rubber band and right-click routing over them. */
function Listing({
  directories,
  files,
  fileActions,
  folderActions,
  viewMode = "grid",
  selected,
  selectedFiles,
  renameTarget,
  onCancelRename,
  onSelectionChange,
  events,
}: ListingProps) {
  const { open: openMenu } = useItemMenu()
  const rootRef = useRef<HTMLDivElement>(null)
  const [band, setBand] = useState<Rect | null>(null)
  const drag = useRef<{
    startX: number
    startY: number
    additive: boolean
    before: ReadonlySet<string>
    items: Array<{ id: string; rect: Rect }>
    scrollEl: HTMLElement | null
    scrollLeft: number
    scrollTop: number
    active: boolean
    raf: number
    lastX: number
    lastY: number
  } | null>(null)
  const suppressClick = useRef(false)

  const onContext = useCallback(
    (target: MenuTarget, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Right-clicking one of several selected files acts on the whole selection.
      if (target.kind === "file" && selected.has(target.file.id) && selected.size > 1) {
        openMenu({ kind: "files", files: selectedFiles }, { x: e.clientX, y: e.clientY })
        return
      }
      openMenu(target, { x: e.clientX, y: e.clientY })
    },
    [openMenu, selected, selectedFiles]
  )

  const cardEvents: FileCardEvents = useMemo(() => ({ ...events, onContext }), [events, onContext])

  const applyBand = useCallback(
    (clientX: number, clientY: number) => {
      const d = drag.current
      if (!d) return
      // Cards were measured at press time; account for how far the pane has scrolled since.
      const dx = (d.scrollEl?.scrollLeft ?? 0) - d.scrollLeft
      const dy = (d.scrollEl?.scrollTop ?? 0) - d.scrollTop
      const rect = rectFromPoints(d.startX - dx, d.startY - dy, clientX, clientY)
      setBand(rect)
      onSelectionChange(
        marqueeSelection(
          rect,
          d.items.map((i) => ({
            id: i.id,
            rect: {
              left: i.rect.left - dx,
              top: i.rect.top - dy,
              right: i.rect.right - dx,
              bottom: i.rect.bottom - dy,
            },
          })),
          d.before,
          d.additive
        )
      )
    },
    [onSelectionChange]
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return
    const target = e.target as HTMLElement
    // Anything but links, fields and the small controls can start a band; a press that
    // never moves past the threshold is still a plain click on whatever it landed on.
    if (target.closest("a, input, textarea, [data-no-marquee]")) return
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-file-id]")).map((el) => {
      const r = el.getBoundingClientRect()
      return {
        id: el.dataset.fileId ?? "",
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      }
    })
    const scrollEl = root.closest("main") as HTMLElement | null
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      additive: e.ctrlKey || e.metaKey || e.shiftKey,
      before: selected,
      items,
      scrollEl,
      scrollLeft: scrollEl?.scrollLeft ?? 0,
      scrollTop: scrollEl?.scrollTop ?? 0,
      active: false,
      raf: 0,
      lastX: e.clientX,
      lastY: e.clientY,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    d.lastX = e.clientX
    d.lastY = e.clientY
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return
      d.active = true
      e.currentTarget.setPointerCapture(e.pointerId)
      // Nudge the pane while the pointer sits near its top or bottom edge.
      const step = () => {
        const cur = drag.current
        if (!cur?.active) return
        const el = cur.scrollEl
        if (el) {
          const r = el.getBoundingClientRect()
          const edge = 48
          let delta = 0
          if (cur.lastY < r.top + edge) delta = -Math.ceil((r.top + edge - cur.lastY) / 4)
          else if (cur.lastY > r.bottom - edge)
            delta = Math.ceil((cur.lastY - (r.bottom - edge)) / 4)
          if (delta !== 0) {
            el.scrollTop += delta
            applyBand(cur.lastX, cur.lastY)
          }
        }
        cur.raf = requestAnimationFrame(step)
      }
      d.raf = requestAnimationFrame(step)
    }
    applyBand(e.clientX, e.clientY)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.active) {
      cancelAnimationFrame(d.raf)
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId)
      setBand(null)
      // The release lands on whatever is under the pointer; that is not a click on it.
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
  }

  const isList = viewMode === "list"

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the listing surface hosts the rubber-band selection and empty-space right-click; every item inside is a button
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => {
        if (!suppressClick.current) return
        e.preventDefault()
        e.stopPropagation()
      }}
      onContextMenu={(e) => {
        const t = e.target as HTMLElement
        if (t.closest("[data-file-id], a, input, textarea")) return
        e.preventDefault()
        openMenu({ kind: "space" }, { x: e.clientX, y: e.clientY })
      }}
      className="relative min-h-[40vh] select-none space-y-6"
    >
      {band ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-30 rounded-sm border border-neutral-90/70 bg-neutral-90/10"
          style={{
            left: band.left,
            top: band.top,
            width: band.right - band.left,
            height: band.bottom - band.top,
          }}
        />
      ) : null}
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
                  onCancelRename={onCancelRename}
                  onContext={onContext}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-3">
              {directories.map((d) => (
                <FolderGridCard
                  key={d.id}
                  dir={d}
                  actions={folderActions}
                  renaming={renameTarget?.kind === "folder" && renameTarget.id === d.id}
                  onCancelRename={onCancelRename}
                  onContext={onContext}
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
                  selected={selected.has(f.id)}
                  onCancelRename={onCancelRename}
                  events={cardEvents}
                />
              ))}
            </div>
          ) : (
            <div className={GRID}>
              {files.map((f) => (
                <FileGridCard
                  key={f.id}
                  file={f}
                  actions={fileActions}
                  renaming={renameTarget?.kind === "file" && renameTarget.id === f.id}
                  selected={selected.has(f.id)}
                  onCancelRename={onCancelRename}
                  events={cardEvents}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
