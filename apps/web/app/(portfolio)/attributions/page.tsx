import type { Metadata } from "next"
import Link from "next/link"
import raw from "@/generated/attributions.json"
import { FooterSection } from "../sections/FooterSection"
import { HeaderSection } from "../sections/HeaderSection"

export const metadata: Metadata = {
  title: "Open source attributions · C-Net",
  description: "Third-party packages C-Net's frontend depends on, and their licenses.",
}

type Attribution = {
  name: string
  version: string
  license: string
  repository?: string
  copyright?: string
  licenseExcerpt?: string
}

const attributions = raw as Attribution[]

export default function AttributionsPage() {
  return (
    <div className="min-h-screen w-full bg-[#faf6f1] text-gray-900">
      <HeaderSection />
      <div className="h-[65px]" aria-hidden="true" />

      <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <Link
          href="/"
          className="inline-block mb-10 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          ← Back
        </Link>

        <header className="mb-12">
          <h1 className="font-satoshi text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
            Open source attributions
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.2em] text-gray-400">
            {attributions.length} packages
          </p>
          <p className="mt-6 text-gray-600 leading-relaxed">
            C-Net's frontend is built on the work below. This list is regenerated from the
            production dependency tree on every build. License text is excerpted; follow the
            repository link for the full terms.
          </p>
        </header>

        <ul className="space-y-4">
          {attributions.map((pkg) => (
            <li
              key={`${pkg.name}@${pkg.version}`}
              className="rounded-lg border border-gray-200 bg-white/60 p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-mono text-sm font-medium text-gray-900">
                  {pkg.repository ? (
                    <a
                      href={pkg.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {pkg.name}
                    </a>
                  ) : (
                    pkg.name
                  )}
                  <span className="ml-2 text-gray-400">{pkg.version}</span>
                </h2>
                <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500">
                  {pkg.license}
                </span>
              </div>

              {pkg.copyright && (
                <p className="mt-2 whitespace-pre-line text-xs text-gray-500">{pkg.copyright}</p>
              )}

              {pkg.licenseExcerpt && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-gray-600">
                    License
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-500">
                    {pkg.licenseExcerpt}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      </article>

      <FooterSection />
    </div>
  )
}
