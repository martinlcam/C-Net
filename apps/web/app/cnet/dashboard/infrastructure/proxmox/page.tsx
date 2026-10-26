"use client"

import { StorageView } from "@/components/storage/StorageView"

export default function StoragePage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-bold text-5xl text-neutral-100">Storage</h1>
      </div>
      <StorageView />
    </div>
  )
}
