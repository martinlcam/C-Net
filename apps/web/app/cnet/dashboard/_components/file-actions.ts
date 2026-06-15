import type { VaultDir, VaultFile } from "@/lib/vault-api"

export type FileActions = {
  onStar: (f: VaultFile) => void
  onRename: (f: VaultFile, name: string) => void
  onDelete: (f: VaultFile) => void
  onColor: (f: VaultFile, color: string | null) => void
}

export type FolderActions = {
  onOpen: (d: VaultDir) => void
  onRename: (d: VaultDir, name: string) => void
  onDelete: (d: VaultDir) => void
}

export type RenameTarget = { kind: "file"; id: string } | { kind: "folder"; id: string } | null
