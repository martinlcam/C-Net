import { describe, expect, it } from "bun:test"
import {
  describeHealth,
  describeMissingEpisodes,
  describeMissingMovie,
  describeQueueItem,
  parseTimeleft,
} from "./request-status"

const NOW = new Date("2026-11-09T12:00:00Z").getTime()

describe("parseTimeleft", () => {
  it("reads hh:mm:ss and d.hh:mm:ss", () => {
    expect(parseTimeleft("00:12:34")).toBe(754)
    expect(parseTimeleft("1.02:00:00")).toBe(93_600)
    expect(parseTimeleft("00:00:05.1234567")).toBe(5)
    expect(parseTimeleft(undefined)).toBeNull()
    expect(parseTimeleft("soon")).toBeNull()
  })
})

describe("describeQueueItem", () => {
  it("reports a healthy download with progress and eta", () => {
    const s = describeQueueItem(7, {
      title: "Film",
      status: "downloading",
      trackedDownloadStatus: "ok",
      trackedDownloadState: "downloading",
      size: 1000,
      sizeleft: 250,
      timeleft: "00:10:00",
      indexer: "YTS (Prowlarr)",
      downloadClient: "qBittorrent",
    })
    expect(s.phase).toBe("downloading")
    expect(s.progress).toBe(75)
    expect(s.etaSeconds).toBe(600)
    expect(s.label).toBe("Downloading, 75%")
    expect(s.detail).toBe("From YTS (Prowlarr) in qBittorrent")
  })

  it("calls out a stalled download with the client's reason", () => {
    const s = describeQueueItem(7, {
      title: "Film",
      status: "warning",
      trackedDownloadStatus: "warning",
      trackedDownloadState: "downloading",
      size: 1000,
      sizeleft: 900,
      statusMessages: [
        { title: "Film", messages: ["The download is stalled with no connections"] },
      ],
    })
    expect(s.phase).toBe("stalled")
    expect(s.label).toBe("Stuck at 10%")
    expect(s.detail).toBe("The download is stalled with no connections")
  })

  it("separates import problems from download failures", () => {
    const blocked = describeQueueItem(1, {
      title: "Film",
      status: "completed",
      trackedDownloadStatus: "warning",
      trackedDownloadState: "importBlocked",
      statusMessages: [{ messages: ["Not an upgrade for existing movie file(s)"] }],
    })
    expect(blocked.phase).toBe("failed")
    expect(blocked.label).toBe("Downloaded but not imported")
    expect(blocked.detail).toContain("Not an upgrade")

    const failed = describeQueueItem(1, {
      title: "Film",
      status: "failed",
      errorMessage: "Torrent was removed from the client",
    })
    expect(failed.phase).toBe("failed")
    expect(failed.detail).toBe("Torrent was removed from the client")
  })

  it("shows importing, paused and queued states", () => {
    expect(
      describeQueueItem(1, {
        title: "F",
        status: "completed",
        trackedDownloadState: "importPending",
      }).phase
    ).toBe("importing")
    expect(describeQueueItem(1, { title: "F", status: "paused" }).phase).toBe("paused")
    const q = describeQueueItem(1, { title: "F", status: "queued", indexer: "1337x" })
    expect(q.phase).toBe("queued")
    expect(q.detail).toBe("Found on 1337x")
  })
})

describe("describeMissingMovie", () => {
  it("explains a film that is still only in cinemas", () => {
    const s = describeMissingMovie(
      {
        id: 11,
        title: "You Can See Everything",
        year: 2026,
        hasFile: false,
        monitored: true,
        isAvailable: false,
        status: "inCinemas",
        minimumAvailability: "released",
        inCinemas: "2026-10-16T00:00:00Z",
      },
      NOW
    )
    expect(s.phase).toBe("waiting")
    expect(s.title).toBe("You Can See Everything (2026)")
    expect(s.detail).toContain("In cinemas since 16 Oct 2026")
    expect(s.detail).toContain("no home release date announced")
  })

  it("names the expected home release date when one is known", () => {
    const s = describeMissingMovie(
      {
        id: 1,
        title: "Film",
        hasFile: false,
        monitored: true,
        isAvailable: false,
        status: "inCinemas",
        digitalRelease: "2026-12-20T00:00:00Z",
      },
      NOW
    )
    expect(s.detail).toContain("Home release expected 20 Dec 2026")
  })

  it("says it is searching once the film is out, with the last search time", () => {
    const s = describeMissingMovie(
      {
        id: 1,
        title: "Film",
        hasFile: false,
        monitored: true,
        isAvailable: true,
        status: "released",
        digitalRelease: "2026-10-01T00:00:00Z",
        added: "2026-10-05T00:00:00Z",
        lastSearchTime: "2026-11-09T09:00:00Z",
      },
      NOW
    )
    expect(s.phase).toBe("searching")
    expect(s.detail).toContain("Out since 1 Oct 2026")
    expect(s.detail).toContain("last looked 3 h ago")
    expect(s.detail).toContain("Rare titles")
  })
})

describe("describeMissingEpisodes", () => {
  it("groups by series and tells unaired from missing", () => {
    const out = describeMissingEpisodes(
      [
        {
          seriesId: 5,
          seasonNumber: 1,
          episodeNumber: 1,
          airDateUtc: "2026-11-01T00:00:00Z",
          series: { title: "Show" },
        },
        {
          seriesId: 5,
          seasonNumber: 1,
          episodeNumber: 2,
          airDateUtc: "2026-11-15T00:00:00Z",
          series: { title: "Show" },
        },
        {
          seriesId: 9,
          seasonNumber: 2,
          episodeNumber: 1,
          airDateUtc: "2026-12-01T00:00:00Z",
          series: { title: "Later" },
        },
      ],
      NOW
    )
    expect(out).toHaveLength(2)
    const show = out.find((s) => s.id === 5)
    expect(show?.phase).toBe("searching")
    expect(show?.label).toBe("Searching for 1 episode")
    expect(show?.detail).toContain("next 15 Nov 2026")
    const later = out.find((s) => s.id === 9)
    expect(later?.phase).toBe("waiting")
    expect(later?.label).toBe("1 episode not aired yet")
  })
})

describe("describeHealth", () => {
  it("keeps real problems and drops update nags", () => {
    const out = describeHealth([
      { type: "warning", source: "UpdateCheck", message: "New update is available" },
      {
        type: "error",
        source: "DownloadClientCheck",
        message: "Unable to communicate with qBittorrent",
      },
      {
        type: "warning",
        source: "IndexerStatusCheck",
        message: "Indexers unavailable due to failures: YTS",
      },
      { type: "notice", source: "Other", message: "ignored" },
    ])
    expect(out).toEqual([
      { level: "error", message: "Unable to communicate with qBittorrent" },
      { level: "warning", message: "Indexers unavailable due to failures: YTS" },
    ])
  })
})
