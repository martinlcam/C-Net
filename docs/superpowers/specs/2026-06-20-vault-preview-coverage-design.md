# Vault preview & thumbnail coverage

**Date:** 2026-06-20
**Status:** Approved (design)

## Problem

The vault has two render surfaces that have drifted apart:

- **Fullscreen preview** (`apps/web/.../file-preview-modal.tsx` + `file-preview.ts`) is
  rich and entirely client-side: image, heic, pdf, pptx, video, audio, html, code, text.
- **Mini grid thumbnails** (`file-thumb.tsx`) only show a server-generated `thumbKey`
  (image/pdf/video) or an inline `<img>` for images; everything else is a generic icon.

Server thumbnails are produced **only** at upload finalize
(`vault-uploads.controller.ts` is the sole producer — no backfill exists), and
`pickGenerator` only supports `image/* | application/pdf | video/*`. Consequences:

- **PPTX / code / text** never get a mini thumbnail (unsupported type).
- **HEIC** routes to the image generator but `sharp`'s prebuilt binary ships without
  libheif, so generation fails → no thumbnail.
- A large class of common docs (**DOCX/XLSX/ODF/RTF/EPUB/CSV**) has neither a thumbnail
  nor a fullscreen preview.

## Goals

Bring thumbnail + fullscreen coverage to all common file types using a **hybrid**
strategy, and make existing files benefit via a one-shot backfill.

## Decisions (locked)

1. **Hybrid generation** — heavy/raster types are server-generated webp thumbnails;
   cheap text types render live in-browser; the rest get a distinctive icon.
2. **Scope: everything common** — Office (DOCX/XLSX/PPTX + legacy DOC/XLS/PPT + ODF
   ODT/ODS/ODP + RTF), EPUB, CSV-as-table, on top of the original code/PPTX/HEIC.
3. **Server tooling** — add **LibreOffice headless** + a **HEIC decoder (libheif)** to
   the workers image.
4. **Backfill** — one-shot script run post-deploy.
5. **Office fullscreen** — LibreOffice converts the doc to **PDF** server-side (cached);
   fullscreen + thumbnail both reuse the existing PDF pipeline. This **replaces** the
   current client-side `pptx-preview` path. (Office-for-web / hosted viewers rejected —
   would leak private files to a third party.)

## Shared classifier

New pure module `packages/core/src/file-types.ts` exporting
`classifyFile(contentType, filename) → FileClass`, where
`FileClass = image | heic | pdf | office | video | audio | html | code | text | csv |
epub | archive | none`. MIME-first with extension fallback (mirrors the current
`file-preview.ts` approach so octet-stream uploads still classify).

Consumed by: the web preview/thumb components, the engine thumbnail worker, and the API
(to decide which files the backfill/reprocess should touch). Web keeps its Prism
`codeLanguage` map layered on top.

Generation responsibility per class:

| Class | Thumbnail | Fullscreen |
|---|---|---|
| image (incl. svg) | server webp (sharp) | `<img>` |
| heic | **server webp (libheif → sharp)** | heic2any (unchanged) |
| pdf | server webp (pdftoppm) | `<object>` |
| video | server webp (ffmpeg) | `<video>` |
| office | **server webp (soffice→pdf→pdftoppm p1)** | **rendered PDF `<object>`** |
| audio | icon | `<audio>` |
| code / text | **live in-tile snippet** | Prism / `<pre>` |
| csv | **live in-tile snippet** | **HTML table** |
| html | live in-tile snippet | iframe (unchanged) |
| epub | book icon | **epub.js reader** |
| archive / none | icon | download-only message |

## Server pipeline

### Conversion module — `packages/engine/src/vault/convert.ts`

- `officeToPdf(sourcePath) → Promise<Buffer | null>` — `soffice --headless
  --convert-to pdf --outdir <tmpdir> <source>`, read back the produced PDF, clean tmp.
  Returns null on missing binary / non-zero exit (same tolerant pattern as `runCapture`).
- `heicToPng(sourcePath) → Promise<Buffer | null>` — decode via libheif
  (`heif-convert`) or ImageMagick to PNG on stdout, for sharp to resize.

### Thumbnail generator — extend `thumbnails.ts`

- `pickGenerator` becomes a thin wrapper over `classifyFile`, returning a
  `ThumbnailKind` of `image | heic | pdf | video | office | null`.
- `generateThumbnail` gains:
  - `heic`: `heicToPng` → sharp resize → webp.
  - `office`: `officeToPdf` → returns **both** the PDF buffer and the page-1 webp
    (so the worker can persist the cached PDF too). Signature changes to return
    `{ thumb: Buffer; pdf?: Buffer } | null`.

### Worker — `apps/workers/src/workers/vault-thumbnails.ts`

For `office`, persist the cached PDF (`adapter.writePdf`) and set `pdfKey`, in addition
to writing the webp and setting `thumbKey`. All other kinds unchanged.

### Storage adapter — `packages/engine/src/vault/{adapter,filesystem-adapter}.ts`

Add `writePdf`, `renderedPdfStream`, `renderedPdfSize(): Promise<number | null>`, and a
`.renders/<id>.pdf` path beside `.thumbs/`. `remove()` also deletes the rendered PDF.

### Docker — `apps/workers/Dockerfile`

`runner` stage installs `libreoffice-core` (+ `libreoffice-impress`/`-calc`/`-writer`
as needed), `libheif-examples` (for `heif-convert`) or `imagemagick`, and ensures
`poppler-utils` (pdftoppm). Base is `oven/bun:1` (Debian) so `apt-get` is available.

## Database

Add nullable `pdf_key text` to `vault_files`. Generate + **commit** the Drizzle
migration alongside the schema change (per repo rule). `toFileDto` exposes
`renderedPdfUrl: string | null` (null when `pdfKey` is null) via a new signed
`/vault/rendered` route.

## API

- `urls.ts`: add `renderedPdfUrl` to `SignedUrls` (signed inline, served by
  `/vault/rendered/:userId/:fileId`), returned as null when no `pdfKey`.
- `download.ts`: add the `/vault/rendered` route — same signature check as `/vault/thumb`,
  streams the cached PDF (`application/pdf`), 404 when absent.
- New `POST /vault/files/:id/reprocess` (controller) — enqueues a thumbnail job for a
  file (used by the fullscreen "preview not ready yet" path; self-heals gaps the backfill
  missed). LibreOffice lives only in the workers image, so conversion is always async via
  the queue — the API never shells out to `soffice`.

## Web

### Fullscreen — `file-preview.ts` + `file-preview-modal.tsx`

- `previewKind` gains `office | epub | csv`; remove the `pptx` client path.
- `office`: if `renderedPdfUrl` present → existing PDF `<object>` using that URL.
  If null → "Preparing preview…", call `reprocess`, poll the listing until
  `renderedPdfUrl` appears.
- `epub`: lazy `epub.js` reader.
- `csv`: parse with `papaparse`, render an HTML table (fallback to `<pre>` on parse error).

### Mini thumbnails — `file-thumb.tsx`

- Server-thumb path unchanged but now fires for heic/office too.
- `code | text | csv`: new `IntersectionObserver`-gated component that, only when the tile
  is on-screen, range-fetches the first ~2 KB (`Range: bytes=0-2047`) and renders a small
  monospace snippet (no syntax highlighting in-tile — perf). Avoids N parallel fetches.
- `epub` → `BookOpen` icon; `archive` → `Archive` icon.

### Client deps

Add `epubjs`, `papaparse`; **remove** `pptx-preview` (only consumer is the modal).

## Backfill

`scripts/vault-backfill-thumbs.ts` — scan `vault_files` where `classifyFile` is a
server-generated kind AND (`thumb_key` is null OR (office AND `pdf_key` is null)),
enqueue a thumbnail job per file. Run once after deploy. The `reprocess` route is the
runtime safety net.

## Testing

- **engine**: `convert.ts` (mock `node:child_process spawn`), new `generateThumbnail`
  branches (heic/office), `pickGenerator`/`classifyFile` tables.
- **core**: `file-types.ts` classification table (MIME + extension fallbacks).
- **web**: extend `file-preview.test.ts` for office/epub/csv; thumb classification.

## Out of scope

- Live PPTX/Office editing; Office-for-web embedding.
- Per-tile syntax highlighting; EPUB cover extraction (book icon for now).
- Streaming/transcoding video; archive content listing.

## Rollout order

1. Shared classifier (`@cnet/core`) + tests.
2. DB migration (`pdf_key`) + DTO/urls/download route.
3. Engine `convert.ts` + `thumbnails.ts` + adapter + tests.
4. Worker office/heic branches.
5. Workers Dockerfile tooling.
6. Web fullscreen (office/epub/csv; drop pptx-preview).
7. Web mini-thumb live snippets + icons.
8. `reprocess` endpoint + backfill script.
9. Lint + build gate; deploy; run backfill.
</content>
</invoke>
