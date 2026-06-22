import { requireEnv } from "@cnet/core"
import { JellyfinService, RadarrService, SonarrService } from "@cnet/engine"

// Lazily-constructed singletons so missing env only errors when Media is used.
let jellyfin: JellyfinService | null = null
let radarr: RadarrService | null = null
let sonarr: SonarrService | null = null

export function getJellyfin(): JellyfinService {
  if (!jellyfin) {
    jellyfin = new JellyfinService(requireEnv("JELLYFIN_HOST"), requireEnv("JELLYFIN_ADMIN_KEY"))
  }
  return jellyfin
}

export function getRadarr(): RadarrService {
  if (!radarr) {
    radarr = new RadarrService(requireEnv("RADARR_HOST"), requireEnv("RADARR_API_KEY"))
  }
  return radarr
}

export function getSonarr(): SonarrService {
  if (!sonarr) {
    sonarr = new SonarrService(requireEnv("SONARR_HOST"), requireEnv("SONARR_API_KEY"))
  }
  return sonarr
}
