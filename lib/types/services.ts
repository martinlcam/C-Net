export type ServiceType = "pi-hole" | "plex" | "minecraft" | "nas"

export type ServiceStatus = "up" | "down" | "degraded"

export interface ServiceHealth {
  service: ServiceType
  status: ServiceStatus
  lastCheck: string
  responseTime?: number // milliseconds
  errorMessage?: string
}

export interface PiHoleStatus {
  status: "enabled" | "disabled"
  domainsBeingBlocked: number
  dnsQueriesToday: number
  adsBlockedToday: number
  adsPercentageToday: number
  uniqueClients: number
  queriesForwarded: number
  queriesCached: number
  uptime: number
}

export interface PlexStatus {
  status: "available" | "unavailable"
  version?: string
  libraries?: number
  activeStreams?: number
}

export interface MinecraftStatus {
  status: "online" | "offline"
  version?: string
  players?: {
    online: number
    max: number
  }
  motd?: string
}
