export { logAuditAction } from "./audit/logger"
export { getResendClient, type SendEmailOptions, sendEmail } from "./email/resend"
export { ContactEmailTemplate } from "./email/templates/contact"
export { JellyfinService } from "./jellyfin/service"
export type {
  JellyfinAuthResult,
  JellyfinItem,
  JellyfinItemsResponse,
  JellyfinLibraryOpts,
  JellyfinUser,
  JellyfinUserData,
} from "./jellyfin/types"
export {
  BAY_CMD_CHANNEL,
  BAY_CMD_MAX_AGE_MS,
  BAY_CMD_REPLY_CHANNEL,
  type BayCommand,
  type BayCommandReply,
  type BayVerb,
  signCommand,
  verifyCommand,
  type ZpoolAction,
} from "./proxmox/bay-commands"
export {
  BAY_INVENTORY_KEY,
  BAY_INVENTORY_MAX_AGE_MS,
  type BayInventory,
  type BayInventoryEntry,
  type BaySlot,
  PROXBOX_BAY_MAP,
  PROXBOX_NODE,
  SLOT_BY_BAY,
} from "./proxmox/bay-map"
export type { BayLiveFrame, BayLiveState, SpinState } from "./proxmox/live-types"
export { ProxmoxService } from "./proxmox/service"
export {
  assembleBays,
  mapPool,
  mapSmart,
  parseScan,
  serialFromByIdPath,
} from "./proxmox/storage"
export type {
  BayController,
  BayInfo,
  BayPool,
  DiskSmart,
  PoolScan,
  PoolStatus,
  PoolVdevLeaf,
  SmartAttribute,
  SmartHealth,
} from "./proxmox/storage-types"
export { type ProxmoxConnectionTestResult, testProxmoxConnection } from "./proxmox/test"
export type { NodeMetrics, ProxmoxNode, ProxmoxVM, StoragePool } from "./proxmox/types"
export { RadarrService } from "./radarr/service"
export type {
  RadarrImage,
  RadarrLookupResult,
  RadarrMovie,
  RadarrQueueItem,
} from "./radarr/types"
export {
  type ServiceTestResult,
  testMinecraftConnection,
  testNASConnection,
  testPiHoleConnection,
  testPlexConnection,
  testServiceConnection,
} from "./services/connectivity"
export type {
  MinecraftStatus,
  PiHoleStatus,
  PlexStatus,
  ServiceHealth,
  ServiceStatus,
  ServiceType,
} from "./services/types"
export { type SonarCloudConfig, SonarCloudService } from "./sonar/service"
export type {
  SonarHotspotRaw,
  SonarHotspotSearchResponse,
  SonarIssueRaw,
  SonarSearchResponse,
} from "./sonar/types"
export type { StorageAdapter } from "./vault/adapter"
export { FilesystemAdapter, getStorageAdapter } from "./vault/filesystem-adapter"
export {
  generateThumbnail,
  pickGenerator,
  type ThumbnailKind,
  type ThumbnailResult,
} from "./vault/thumbnails"
export type { JellyfinMediaType } from "./jellyfin/types"
export { SonarrService } from "./sonarr/service"
export type {
  SonarrImage,
  SonarrLookupResult,
  SonarrQueueItem,
  SonarrSeries,
  SonarrStatistics,
} from "./sonarr/types"
