"use client"

import { getStarred } from "@/lib/vault-api"
import { FileView } from "../_components/file-view"

export default function StarredPage() {
  return (
    <FileView
      title="Starred"
      queryKey="starred"
      fetcher={getStarred}
      empty="No starred files yet"
    />
  )
}
