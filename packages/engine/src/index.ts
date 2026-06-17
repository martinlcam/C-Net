export { logAuditAction } from "./audit/logger"
export { getResendClient, type SendEmailOptions, sendEmail } from "./email/resend"
export { ContactEmailTemplate } from "./email/templates/contact"
export { BAY_BY_SERIAL, type BaySlot, PROXBOX_BAY_MAP, PROXBOX_NODE } from "./proxmox/bay-map"
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
export { generateThumbnail, pickGenerator, type ThumbnailKind } from "./vault/thumbnails"
