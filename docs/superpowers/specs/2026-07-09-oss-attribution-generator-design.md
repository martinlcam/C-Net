# OSS attribution generator

**Date:** 2026-07-09
**Status:** Implemented

## Problem

C-Net shipped no record of its third-party dependencies or their licenses. The repo is
GPL-3.0 and public, and the permissive licenses in the web app's production dependency
graph (MIT/BSD/ISC/Apache-2.0) require their notices and copyright lines be preserved.

Separately, there was no supply-chain check in CI — no `bun audit`, no dependabot.

## Goals

1. Generate `apps/web/generated/attributions.json` from the web app's production
   dependency tree, transitive deps included.
2. Keep it current automatically, without ever blocking a build.
3. Render it at `/attributions`.
4. Add a supply-chain gate using the tool already installed.

## Non-goals

- **No "suspicious package" heuristic.** Package age and download count catch typosquats
  but miss the attack that actually recurs: a legitimate, popular, long-lived package
  whose maintainer is compromised and publishes a bad version (`event-stream`,
  `ua-parser-js`, the 2025 `chalk`/`debug` incident). Such a package has a spotless age
  and traffic record. An age gate would redden CI on a new Radix subpackage while waving
  the real thing through. `bun audit` covers known-bad versions instead.
- **No monorepo-wide scan.** Web production deps only — that's the code that ships to
  users. The API, workers, and engine are not attributed here.
- **No license-compatibility denylist.**
- **No CI drift check.** `prebuild` regenerates before every `next build`, so the page is
  always current at deploy time. The committed snapshot is a convenience artifact.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Scanner | `license-checker-rseidelsohn --production --json` | Resolves Bun's `node_modules/.bun` store correctly. Verified: 318 entries, 5 of them C-Net's own workspaces. |
| Scope | `apps/web` production deps, transitive | What ships to the browser. |
| When it runs | `prebuild` | Auto-current at build and deploy time; no separate CI job to rot. |
| On scanner failure | Warn, keep existing snapshot, exit 0 | A flaky license-checker run must never block a Proxmox deploy. |
| License text | First 30 lines (`LICENSE_EXCERPT_LINES`) | The page shows a gist, not a notice file. Truncates full Apache-2.0/GPL text — accepted. |
| Missing copyright | Omit the field | Many legitimate packages have no parseable copyright line. |
| `bun audit` | `--audit-level=critical`, with 5 documented ignores | See *Audit* below. |

### Why copyright is scraped defensively

The reference implementation that motivated this work emitted:

```json
{ "name": "@heroicons/react", "version": "2.2.0",
  "copyright": "Copyright (c) 2021 Vitaly Rtishchev", ... }
```

Vitaly Rtishchev authors Mantine, not Heroicons. That entry also carried **no `license`
field**. Both are artifacts of regex-scraping copyright out of license text and emitting
whatever turns up.

Two guards, each with a test:

- **Boilerplate rejection.** ISC's permission grant wraps onto a line that literally
  begins with the word "copyright" (`"...provided that the above\ncopyright notice and
  this permission notice appear in all copies."`). A naive `^copyright` match swallows it
  — the first implementation here did exactly that, producing
  `"Copyright (c) 2022-2024, Balázs Orbán\ncopyright notice and this permission notice
  appear in all copies."` for `@auth/core`. Lines starting `copyright notice|holder|owner`
  are now dropped.
- **Placeholder rejection.** Apache-2.0's appendix contains
  `Copyright [yyyy] [name of copyright owner]`; templates are dropped.

When nothing survives, the field is omitted. A wrong attribution is worse than a missing
one.

### README fallback

`license-checker` sets `licenseFile` to a package's README when the package ships no
license file, which would land package prose in `licenseExcerpt`. `isLicenseFile()` gates
on the basename (`licen[cs]e`, `copying`, `unlicen[cs]e`).

## Design

`apps/web/scripts/scan-attributions.ts`, matching the repo's `bun scripts/*.ts` style.
Helpers are exported so `scan-attributions.test.ts` can cover them without shelling out;
`main()` runs only when the module is the entrypoint (`process.argv[1]` compared against
the resolved script path).

The script avoids Bun-only globals (`import.meta.dir`, `import.meta.main`,
`Bun.spawnSync`). `apps/web/tsconfig.json` includes `**/*.ts`, so Next typechecks this
file against its own `ImportMeta` and these fail the build. It uses `fileURLToPath` and
`node:child_process` instead, invoking the checker through `process.execPath` (`bun x …`)
rather than relying on `bunx` being resolvable on PATH — which is fragile on Windows.
`maxBuffer` is raised to 64 MB; the report embeds an absolute path per package and
overruns node's 1 MB default.

Output shape, sorted by name then version in **codepoint order** (`localeCompare` varies
across ICU builds and would churn the diff):

```json
[
  {
    "name": "@alloc/quick-lru",
    "version": "5.2.0",
    "license": "MIT",
    "repository": "https://github.com/sindresorhus/quick-lru",
    "copyright": "Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)",
    "licenseExcerpt": "MIT License\n\nCopyright (c) …"
  }
]
```

`repository`, `copyright`, and `licenseExcerpt` are omitted when absent rather than
serialized as `null`. Dual licenses join as `"MIT OR Apache-2.0"`. Private packages and
the `@cnet/` scope are filtered out.

Current output: **313 packages**, zero `UNKNOWN` licenses, 27 without a license file
(they declare a license in `package.json` but ship no text), 37 without a copyright line.

## Page

`apps/web/app/(portfolio)/attributions/page.tsx` — a server component importing the JSON
directly (`resolveJsonModule` is inherited from `tsconfig.base.json`). Styled after the
existing `/deployment` writeup: `HeaderSection`, `bg-[#faf6f1]`, `font-satoshi` heading,
`FooterSection`. Each package is a card with a repo link, version, license badge,
copyright, and a collapsible `<details>` license excerpt. Prerenders as static.

The scanner writes `[]` when it fails and no snapshot exists, so a fresh clone's first
build cannot break on a missing import.

## Audit

A new `audit` job in `.github/workflows/ci.yml` (`needs: [bugcat]`, matching the existing
job graph) runs `bun audit --audit-level=critical` with **no ignore list**.

`bun audit` initially reported 108 advisories, 5 of them critical. Rather than ignore
them, all five were fixed — every one had a published patch. Advisory counts are now
96 total, **0 critical**.

`bun update` alone was insufficient: this repo pins exact versions (see
`scripts/pin-deps.ts`), and Bun's `update` only touches direct dependencies. The three
vulnerable packages were all transitive or peer-resolved, so a root `overrides` block
does the work:

```json
"overrides": {
  "@vitest/browser": "4.1.10",
  "handlebars": "4.7.9",
  "shell-quote": "1.9.0",
  "vitest": "4.1.10"
}
```

| Advisory | Package | Reached via | Fix |
|---|---|---|---|
| `GHSA-2w6w-674q-4c4q` | handlebars 4.7.8 | `@cnet/api` → `tsoa` → `@tsoa/cli` (a **production** dependency; controllers import decorators from `tsoa`) | override → 4.7.9 |
| `GHSA-w7jw-789q-3m8p` | shell-quote 1.8.3 | `@cnet/db` → `drizzle-kit` → `gel`. `drizzle-orm` only *lists* `gel` as an optional peer; the installed copy comes from `drizzle-kit`, which runs in production via `scripts/deploy.sh` → `bun run db:migrate` | override → 1.9.0 |
| `GHSA-5xrq-8626-4rwp` | vitest 4.0.18 | direct devDependency, plus a nested copy under `@vitest/browser` | pin → 4.1.10 + override |
| `GHSA-2h32-95rg-cppp`, `GHSA-g8mr-85jm-7xhm` | `@vitest/browser` 4.0.18 | optional peer of `@storybook/addon-vitest`; not a direct dependency, so bumping `package.json` did not reach it | override → 4.1.10 |

`vitest` is unused for testing — every test in the repo is `bun:test`, and nothing
imports from `vitest`. Its only consumer is the `@storybook/addon-vitest` addon in
`.storybook/main.ts`. Removing that addon would drop four devDependencies; upgrading was
chosen instead because it leaves Storybook's behavior untouched.

Verified after the change: `bun audit --audit-level=critical` exits 0, `apps/api` builds
(exercising tsoa codegen on handlebars 4.7.9), and `vitest` resolves to 4.1.10.

## Testing

`apps/web/scripts/scan-attributions.test.ts` — 18 `bun:test` cases covering
`parsePackageKey` (scoped names split on the last `@`), `normalizeLicense` (dual-license
join, `UNKNOWN` fallback), `shouldInclude` (private and `@cnet/` filtering),
`isLicenseFile` (README rejection), `findCopyright` (ISC boilerplate, Apache placeholder,
dedupe, no-guess), `sortAttributions` (codepoint order), and `buildAttributions`
(omission rather than `null`).

Verified end-to-end: deleting the snapshot and running `bun run build` regenerates it via
`prebuild` and prerenders `/attributions`.

## Known gaps

- The 30-line excerpt truncates Apache-2.0 and GPL texts. Fine for a credits page, not a
  legally complete notice file.
- `license-checker-rseidelsohn` adds ~200 transitive devDependencies (npm internals).
- Scanner failure is silent by design, so a persistently broken scan leaves the committed
  snapshot stale without a signal.
