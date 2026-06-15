"use client"

import { getColored } from "@/lib/vault-api"
import { FileView } from "../_components/file-view"

export default function ColoredPage() {
  return (
    <FileView
      title="Colored"
      queryKey="colored"
      fetcher={getColored}
      empty="No color-tagged files yet"
      colorFilter
    />
  )
}
