import { describe, expect, it } from "bun:test"
import { airingChip, airingLine } from "./airing-label"

// A Monday at noon UTC; the helpers take `now` explicitly so the tests do not depend on the clock.
const NOW = Date.parse("2026-10-26T12:00:00Z")
const base = {
  status: "continuing" as const,
  nextAiring: null,
  previousAiring: null,
  airDay: null,
  network: null,
  source: "sonarr" as const,
}

describe("airingChip", () => {
  it("says nothing for ended or unknown series", () => {
    expect(airingChip(null, NOW)).toBeNull()
    expect(airingChip({ ...base, status: "ended" }, NOW)).toBeNull()
  })
  it("names the weekday when the next episode is within the week", () => {
    expect(airingChip({ ...base, nextAiring: "2026-10-28T15:00:00Z" }, NOW)).toBe("Next ep Wed")
    expect(airingChip({ ...base, nextAiring: "2026-10-26T20:00:00Z" }, NOW)).toBe("Next ep today")
    expect(airingChip({ ...base, nextAiring: "2026-10-27T03:00:00Z" }, NOW)).toBe(
      "Next ep tomorrow"
    )
  })
  it("names the date when the next episode is further out", () => {
    expect(airingChip({ ...base, nextAiring: "2026-11-15T15:00:00Z" }, NOW)).toBe("Next ep 15 Nov")
  })
  it("falls back to the air day, then to a plain airing mark", () => {
    expect(airingChip({ ...base, airDay: "Monday" }, NOW)).toBe("Airs Mondays")
    expect(airingChip(base, NOW)).toBe("Airing")
  })
  it("marks shows that have not started", () => {
    expect(airingChip({ ...base, status: "upcoming" }, NOW)).toBe("Upcoming")
  })
})

describe("airingLine", () => {
  it("reads as one sentence with the network and the next date when known", () => {
    expect(
      airingLine({ ...base, network: "Crunchyroll", nextAiring: "2026-10-27T15:00:00Z" }, NOW)
    ).toBe("Continuing on Crunchyroll, next episode Tuesday 27 October")
  })
  it("handles ended and unknown shows plainly", () => {
    expect(airingLine({ ...base, status: "ended", network: "NHK" }, NOW)).toBe(
      "Ended, aired on NHK"
    )
    expect(airingLine(null, NOW)).toBeNull()
  })
})

describe("between seasons", () => {
  it("stays quiet when a continuing show has no next date and the last episode is old", () => {
    const hiatus = { ...base, previousAiring: "2026-07-27T03:00:00Z" }
    expect(airingChip(hiatus, NOW)).toBeNull()
    expect(airingLine({ ...hiatus, network: "Adult Swim" }, NOW)).toBe(
      "Between seasons on Adult Swim, last episode 27 July"
    )
  })
  it("still shows a plain airing mark when the last episode was recent", () => {
    expect(airingChip({ ...base, previousAiring: "2026-10-20T03:00:00Z" }, NOW)).toBe("Airing")
  })
})
