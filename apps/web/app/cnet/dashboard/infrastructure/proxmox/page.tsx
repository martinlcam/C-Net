"use client"

import { useState } from "react"
import { StorageView } from "@/components/storage/StorageView"
import { VMsView } from "@/components/vms/VMsView"

type Tab = "storage" | "vms"

export default function ProxmoxPage() {
  const [tab, setTab] = useState<Tab>("storage")

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-5xl font-bold text-neutral-100">Proxmox · proxbox</h1>
      </div>

      <div className="mb-6 flex gap-1 border-b border-neutral-30">
        <TabButton active={tab === "storage"} onClick={() => setTab("storage")}>
          Storage
        </TabButton>
        <TabButton active={tab === "vms"} onClick={() => setTab("vms")}>
          VMs &amp; Containers
        </TabButton>
      </div>

      {tab === "storage" ? <StorageView /> : <VMsView />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-4 py-2 text-base font-medium transition",
        active
          ? "border-primary-purple-40 text-primary-purple-40"
          : "border-transparent text-neutral-50 hover:text-neutral-70",
      ].join(" ")}
    >
      {children}
    </button>
  )
}
