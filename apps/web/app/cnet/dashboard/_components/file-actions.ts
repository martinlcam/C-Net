import type { VaultDir, VaultFile } from "@/lib/vault-api"

/** One change applied to many files at once (a selection). */
export type BulkOp =
  | { kind: "star"; starred: boolean }
  | { kind: "color"; color: string | null }
  | { kind: "move"; directoryId: string | null }
  | { kind: "delete" }

export type FileActions = {
  onStar: (f: VaultFile) => void
  onRename: (f: VaultFile, name: string) => void
  onDelete: (f: VaultFile) => void
  onColor: (f: VaultFile, color: string | null) => void
  onMove: (f: VaultFile, directoryId: string | null) => void
  /** Resolves when every file has been attempted; the listing is refreshed once at the end. */
  onBulk: (files: VaultFile[], op: BulkOp) => Promise<void>
}

export type FolderActions = {
  onOpen: (d: VaultDir) => void
  onRename: (d: VaultDir, name: string) => void
  onDelete: (d: VaultDir) => void
}

/** What a right-click on empty space in a folder can do. */
export type SpaceActions = {
  onNewFolder?: () => void
  onUpload?: () => void
}

export type RenameTarget = { kind: "file"; id: string } | { kind: "folder"; id: string } | null
