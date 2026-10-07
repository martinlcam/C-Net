// Sidecar subtitle support for the files preview player. Browsers only render WebVTT in a
// <track>, so SRT is converted client-side; the vault stores subtitles as plain files, so a
// track is any .srt/.vtt in the same folder sharing the media file's basename
// ("Movie.mp4" ↔ "Movie.srt", "Movie.en.vtt").

const SUBTITLE_EXT = new Set(["srt", "vtt"])

function ext(filename: string): string {
  const i = filename.lastIndexOf(".")
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase()
}

function stem(filename: string): string {
  const i = filename.lastIndexOf(".")
  return i === -1 ? filename : filename.slice(0, i)
}

export function isSubtitleFile(filename: string): boolean {
  return SUBTITLE_EXT.has(ext(filename))
}

/** Convert SubRip text to WebVTT. WebVTT input (with or without a BOM) passes through. */
export function srtToVtt(text: string): string {
  const body = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n")
  if (body.startsWith("WEBVTT")) return body
  const cues = body.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
  return `WEBVTT\n\n${cues.trim()}\n`
}

/** The optional language tag between the media stem and the extension, e.g. "en" in "Movie.en.vtt". */
function languageTag(mediaFilename: string, subtitleFilename: string): string | null {
  const mediaStem = stem(mediaFilename).toLowerCase()
  const subStem = stem(subtitleFilename)
  if (subStem.toLowerCase() === mediaStem) return null
  if (!subStem.toLowerCase().startsWith(`${mediaStem}.`)) return null
  const tag = subStem.slice(mediaStem.length + 1)
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(tag) ? tag : null
}

function matchesMedia(mediaFilename: string, subtitleFilename: string): boolean {
  if (!isSubtitleFile(subtitleFilename)) return false
  const mediaStem = stem(mediaFilename).toLowerCase()
  const subStem = stem(subtitleFilename).toLowerCase()
  return subStem === mediaStem || languageTag(mediaFilename, subtitleFilename) !== null
}

export function findSubtitleSiblings<T extends { filename: string }>(
  mediaFilename: string,
  files: T[]
): T[] {
  return files.filter((f) => matchesMedia(mediaFilename, f.filename))
}

export function subtitleLabel(mediaFilename: string, subtitleFilename: string): string {
  return languageTag(mediaFilename, subtitleFilename) ?? "Subtitles"
}
