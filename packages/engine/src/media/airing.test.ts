import { describe, expect, it } from "bun:test"
import type { JellyfinItem } from "../jellyfin/types"
import type { SonarrSeries } from "../sonarr/types"
import { airingInfo, matchSonarrSeries } from "./airing"

const jf = (over: Partial<JellyfinItem> = {}): JellyfinItem => ({
  Id: "j1",
  Name: "JoJo's Bizarre Adventure (2012)",
  Type: "Series",
  ProductionYear: 2012,
  ...over,
})
const sr = (over: Partial<SonarrSeries> = {}): SonarrSeries => ({
  id: 19,
  title: "JoJo's Bizarre Adventure (2012)",
  year: 2012,
  tvdbId: 262954,
  monitored: true,
  status: "continuing",
  nextAiring: "2026-10-27T15:00:00Z",
  previousAiring: "2026-10-20T15:00:00Z",
  network: "Crunchyroll",
  ...over,
})

describe("matchSonarrSeries", () => {
  it("matches on the TVDB id first", () => {
    const item = jf({ Name: "Different title", ProviderIds: { Tvdb: "262954" } })
    expect(matchSonarrSeries(item, [sr({ title: "x" }), sr({ id: 2, tvdbId: 1 })])?.id).toBe(19)
  })
  it("falls back to title and year when there is no provider id", () => {
    expect(matchSonarrSeries(jf(), [sr({ id: 7, tvdbId: 1 })])?.id).toBe(7)
    expect(matchSonarrSeries(jf({ ProductionYear: 1999 }), [sr()])).toBeUndefined()
  })
})

describe("airingInfo", () => {
  it("prefers Sonarr: status, next and previous air times, air day and network", () => {
    expect(airingInfo(jf(), sr())).toEqual({
      status: "continuing",
      nextAiring: "2026-10-27T15:00:00Z",
      previousAiring: "2026-10-20T15:00:00Z",
      airDay: "Tuesday",
      network: "Crunchyroll",
      source: "sonarr",
    })
  })
  it("reports an ended series without a next episode", () => {
    const info = airingInfo(jf(), sr({ status: "ended", nextAiring: undefined }))
    expect(info?.status).toBe("ended")
    expect(info?.nextAiring).toBeNull()
  })
  it("falls back to Jellyfin's Status and AirDays when Sonarr has no entry", () => {
    const info = airingInfo(jf({ Status: "Continuing", AirDays: ["Monday"] }), undefined)
    expect(info).toEqual({
      status: "continuing",
      nextAiring: null,
      previousAiring: null,
      airDay: "Monday",
      network: null,
      source: "jellyfin",
    })
  })
  it("is null when neither side knows anything", () => {
    expect(airingInfo(jf(), undefined)).toBeNull()
  })
})
