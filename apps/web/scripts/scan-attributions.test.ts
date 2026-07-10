import { describe, expect, it } from "bun:test"
import {
  buildAttributions,
  findCopyright,
  isLicenseFile,
  normalizeLicense,
  parsePackageKey,
  shouldInclude,
  sortAttributions,
} from "./scan-attributions"

describe("parsePackageKey", () => {
  it("splits on the last @ so scoped names survive", () => {
    expect(parsePackageKey("@radix-ui/react-dialog@1.1.15")).toEqual({
      name: "@radix-ui/react-dialog",
      version: "1.1.15",
    })
  })

  it("handles unscoped names", () => {
    expect(parsePackageKey("clsx@2.1.1")).toEqual({ name: "clsx", version: "2.1.1" })
  })

  it("tolerates a missing version", () => {
    expect(parsePackageKey("clsx")).toEqual({ name: "clsx", version: "" })
  })
})

describe("normalizeLicense", () => {
  it("joins dual licenses", () => {
    expect(normalizeLicense(["MIT", "Apache-2.0"])).toBe("MIT OR Apache-2.0")
  })

  it("falls back to UNKNOWN rather than emitting an empty license", () => {
    expect(normalizeLicense(undefined)).toBe("UNKNOWN")
    expect(normalizeLicense("  ")).toBe("UNKNOWN")
  })
})

describe("shouldInclude", () => {
  it("drops C-Net's own workspaces", () => {
    expect(shouldInclude("@cnet/core@0.0.0", { private: true })).toBe(false)
    expect(shouldInclude("@cnet/engine@0.0.0", {})).toBe(false)
  })

  it("drops any private package", () => {
    expect(shouldInclude("something@1.0.0", { private: true })).toBe(false)
  })

  it("keeps third-party packages", () => {
    expect(shouldInclude("clsx@2.1.1", { licenses: "MIT" })).toBe(true)
  })
})

describe("isLicenseFile", () => {
  it("accepts the usual spellings", () => {
    expect(isLicenseFile("/pkg/LICENSE")).toBe(true)
    expect(isLicenseFile("/pkg/licence.md")).toBe(true)
    expect(isLicenseFile("/pkg/COPYING")).toBe(true)
    expect(isLicenseFile("/pkg/UNLICENSE")).toBe(true)
  })

  it("rejects the README fallback license-checker returns when no license file exists", () => {
    expect(isLicenseFile("/pkg/README.md")).toBe(false)
  })
})

describe("findCopyright", () => {
  it("extracts a copyright line", () => {
    expect(findCopyright("MIT License\n\nCopyright (c) 2021 Someone\n\nPermission...")).toBe(
      "Copyright (c) 2021 Someone"
    )
  })

  it("ignores permission boilerplate that wraps onto a line starting with 'copyright'", () => {
    const isc = [
      "ISC License",
      "",
      "Copyright (c) 2022-2024, Balázs Orbán",
      "",
      "Permission to use, copy, modify, and/or distribute this software for any",
      "purpose with or without fee is hereby granted, provided that the above",
      "copyright notice and this permission notice appear in all copies.",
    ].join("\n")
    expect(findCopyright(isc)).toBe("Copyright (c) 2022-2024, Balázs Orbán")
  })

  it("ignores Apache-style placeholder templates", () => {
    expect(findCopyright("Copyright [yyyy] [name of copyright owner]")).toBeUndefined()
  })

  it("returns undefined rather than guessing when no copyright line exists", () => {
    expect(findCopyright("Permission is hereby granted, free of charge...")).toBeUndefined()
  })

  it("dedupes repeated lines and keeps distinct holders", () => {
    const text = "Copyright (c) 2020 A\nCopyright (c) 2020 A\nCopyright (c) 2021 B"
    expect(findCopyright(text)).toBe("Copyright (c) 2020 A\nCopyright (c) 2021 B")
  })
})

describe("sortAttributions", () => {
  it("sorts by codepoint, then version", () => {
    const sorted = sortAttributions([
      { name: "b", version: "1.0.0", license: "MIT" },
      { name: "a", version: "2.0.0", license: "MIT" },
      { name: "a", version: "1.0.0", license: "MIT" },
      { name: "B", version: "1.0.0", license: "MIT" },
    ])
    expect(sorted.map((a) => `${a.name}@${a.version}`)).toEqual([
      "B@1.0.0",
      "a@1.0.0",
      "a@2.0.0",
      "b@1.0.0",
    ])
  })
})

describe("buildAttributions", () => {
  it("filters, builds, and sorts in one pass", () => {
    const attributions = buildAttributions({
      "zod@3.0.0": { licenses: "MIT", repository: "https://github.com/colinhacks/zod" },
      "@cnet/core@0.0.0": { private: true },
      "clsx@2.1.1": { licenses: "MIT" },
    })
    expect(attributions.map((a) => a.name)).toEqual(["clsx", "zod"])
  })

  it("omits repository, copyright, and excerpt rather than emitting null", () => {
    const [attribution] = buildAttributions({ "clsx@2.1.1": { licenses: "MIT" } })
    expect(attribution).toEqual({ name: "clsx", version: "2.1.1", license: "MIT" })
  })
})
