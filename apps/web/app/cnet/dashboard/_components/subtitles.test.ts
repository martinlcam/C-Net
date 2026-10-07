import { describe, expect, it } from "bun:test"
import { findSubtitleSiblings, isSubtitleFile, srtToVtt, subtitleLabel } from "./subtitles"

describe("srtToVtt", () => {
  it("converts cue timestamps and prepends the WEBVTT header", () => {
    const srt =
      "1\r\n00:00:01,000 --> 00:00:03,500\r\nHello\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nWorld\r\n"
    expect(srtToVtt(srt)).toBe(
      "WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500\nHello\n\n2\n00:00:04.000 --> 00:00:05.000\nWorld\n"
    )
  })

  it("strips a UTF-8 BOM and leaves WebVTT input alone", () => {
    expect(srtToVtt("﻿WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n")).toBe(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n"
    )
  })
})

describe("isSubtitleFile", () => {
  it("accepts srt and vtt by extension, case-insensitively", () => {
    expect(isSubtitleFile("clip.srt")).toBe(true)
    expect(isSubtitleFile("clip.EN.VTT")).toBe(true)
    expect(isSubtitleFile("clip.mp4")).toBe(false)
    expect(isSubtitleFile("clip.ass")).toBe(false)
  })
})

describe("findSubtitleSiblings", () => {
  const files = [
    { id: "1", filename: "Movie.mp4" },
    { id: "2", filename: "Movie.srt" },
    { id: "3", filename: "movie.en.vtt" },
    { id: "4", filename: "Movie.fr.srt" },
    { id: "5", filename: "Other.srt" },
    { id: "6", filename: "Movie (1).srt" },
  ]

  it("matches same-basename subtitle files, with or without a language tag", () => {
    expect(findSubtitleSiblings("Movie.mp4", files).map((f) => f.id)).toEqual(["2", "3", "4"])
  })

  it("returns nothing for media with no matching sidecars", () => {
    expect(findSubtitleSiblings("Nothing.mkv", files)).toEqual([])
  })
})

describe("subtitleLabel", () => {
  it("names the track by its language tag, falling back to a generic label", () => {
    expect(subtitleLabel("Movie.mp4", "Movie.en.vtt")).toBe("en")
    expect(subtitleLabel("Movie.mp4", "Movie.srt")).toBe("Subtitles")
    expect(subtitleLabel("Movie.mp4", "Movie.pt-BR.srt")).toBe("pt-BR")
  })
})
