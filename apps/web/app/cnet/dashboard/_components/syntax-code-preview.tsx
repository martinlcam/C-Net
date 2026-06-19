"use client"

import { useEffect, useState } from "react"
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { codeLanguage } from "./file-preview"

const registered = new Set<string>()

const languageLoaders: Record<string, () => Promise<{ default: unknown }>> = {
  bash: () => import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
  c: () => import("react-syntax-highlighter/dist/esm/languages/prism/c"),
  cpp: () => import("react-syntax-highlighter/dist/esm/languages/prism/cpp"),
  csharp: () => import("react-syntax-highlighter/dist/esm/languages/prism/csharp"),
  css: () => import("react-syntax-highlighter/dist/esm/languages/prism/css"),
  go: () => import("react-syntax-highlighter/dist/esm/languages/prism/go"),
  graphql: () => import("react-syntax-highlighter/dist/esm/languages/prism/graphql"),
  hcl: () => import("react-syntax-highlighter/dist/esm/languages/prism/hcl"),
  java: () => import("react-syntax-highlighter/dist/esm/languages/prism/java"),
  javascript: () => import("react-syntax-highlighter/dist/esm/languages/prism/javascript"),
  json: () => import("react-syntax-highlighter/dist/esm/languages/prism/json"),
  jsx: () => import("react-syntax-highlighter/dist/esm/languages/prism/jsx"),
  kotlin: () => import("react-syntax-highlighter/dist/esm/languages/prism/kotlin"),
  less: () => import("react-syntax-highlighter/dist/esm/languages/prism/less"),
  lua: () => import("react-syntax-highlighter/dist/esm/languages/prism/lua"),
  markdown: () => import("react-syntax-highlighter/dist/esm/languages/prism/markdown"),
  markup: () => import("react-syntax-highlighter/dist/esm/languages/prism/markup"),
  php: () => import("react-syntax-highlighter/dist/esm/languages/prism/php"),
  powershell: () => import("react-syntax-highlighter/dist/esm/languages/prism/powershell"),
  protobuf: () => import("react-syntax-highlighter/dist/esm/languages/prism/protobuf"),
  python: () => import("react-syntax-highlighter/dist/esm/languages/prism/python"),
  ruby: () => import("react-syntax-highlighter/dist/esm/languages/prism/ruby"),
  rust: () => import("react-syntax-highlighter/dist/esm/languages/prism/rust"),
  sass: () => import("react-syntax-highlighter/dist/esm/languages/prism/sass"),
  scss: () => import("react-syntax-highlighter/dist/esm/languages/prism/scss"),
  sql: () => import("react-syntax-highlighter/dist/esm/languages/prism/sql"),
  swift: () => import("react-syntax-highlighter/dist/esm/languages/prism/swift"),
  toml: () => import("react-syntax-highlighter/dist/esm/languages/prism/toml"),
  tsx: () => import("react-syntax-highlighter/dist/esm/languages/prism/tsx"),
  typescript: () => import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
  yaml: () => import("react-syntax-highlighter/dist/esm/languages/prism/yaml"),
}

async function ensureLanguage(lang: string): Promise<void> {
  if (registered.has(lang)) return
  const load = languageLoaders[lang]
  if (!load) throw new Error(`Unsupported language: ${lang}`)
  const mod = await load()
  SyntaxHighlighter.registerLanguage(
    lang,
    mod.default as Parameters<typeof SyntaxHighlighter.registerLanguage>[1]
  )
  registered.add(lang)
}

function resolveLanguage(filename: string, contentType: string | null): string {
  const fromExt = codeLanguage(filename)
  if (fromExt) return fromExt
  const mime = (contentType ?? "").split(";")[0].trim().toLowerCase()
  if (mime === "application/json") return "json"
  if (mime === "application/javascript" || mime === "application/x-javascript") return "javascript"
  return "text"
}

export function SyntaxCodePreview({
  url,
  filename,
  contentType,
}: {
  url: string
  filename: string
  contentType: string | null
}) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const language = resolveLanguage(filename, contentType)

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setError(null)
    setReady(false)

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`)
        return res.text()
      })
      .then(async (text) => {
        if (cancelled) return
        try {
          await ensureLanguage(language)
        } catch {
          if (!cancelled) setError("Syntax highlighting unavailable for this language.")
          return
        }
        if (!cancelled) {
          setContent(text)
          setReady(true)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [url, language])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-neutral-60">
        <p className="text-sm">{error}</p>
      </div>
    )
  }
  if (!ready || content === null) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-60 text-sm">
        Loading preview…
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto bg-[#282c34]">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        customStyle={{
          margin: 0,
          padding: "1rem 0",
          background: "#282c34",
          fontSize: "0.8rem",
          lineHeight: 1.6,
          minHeight: "100%",
        }}
        lineNumberStyle={{
          minWidth: "2.75rem",
          paddingRight: "1rem",
          color: "#5c6370",
          userSelect: "none",
        }}
        codeTagProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  )
}
