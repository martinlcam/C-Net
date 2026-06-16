"use client"

import type { ProxmoxVM } from "@cnet/engine"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { StorageView } from "@/components/storage/StorageView"
import { VMList } from "@/components/VMList"
import { Button } from "@/stories/button/button"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

async function fetchVMs(): Promise<ProxmoxVM[]> {
  const response = await fetch(`${API_BASE}/proxmox/vms`, { credentials: "include" })
  if (!response.ok) {
    throw new Error("Failed to fetch VMs")
  }
  const data = await response.json()
  return data.data || []
}

async function startVM(vmid: number): Promise<{ success: boolean; taskId: string }> {
  const response = await fetch(`${API_BASE}/proxmox/vms/${vmid}/start`, {
    method: "POST",
    credentials: "include",
  })
  if (!response.ok) {
    throw new Error("Failed to start VM")
  }
  return response.json()
}

async function stopVM(vmid: number): Promise<{ success: boolean; taskId: string }> {
  const response = await fetch(`${API_BASE}/proxmox/vms/${vmid}/stop`, {
    method: "POST",
    credentials: "include",
  })
  if (!response.ok) {
    throw new Error("Failed to stop VM")
  }
  return response.json()
}

async function restartVM(vmid: number): Promise<{ success: boolean; taskId: string }> {
  const response = await fetch(`${API_BASE}/proxmox/vms/${vmid}/restart`, {
    method: "POST",
    credentials: "include",
  })
  if (!response.ok) {
    throw new Error("Failed to restart VM")
  }
  return response.json()
}

type Tab = "storage" | "vms"

function VMsTab() {
  const queryClient = useQueryClient()
  const {
    data: vms = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["proxmox", "vms"],
    queryFn: fetchVMs,
    refetchInterval: 30000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["proxmox", "vms"] })
  const startMutation = useMutation({ mutationFn: startVM, onSuccess: invalidate })
  const stopMutation = useMutation({ mutationFn: stopVM, onSuccess: invalidate })
  const restartMutation = useMutation({ mutationFn: restartVM, onSuccess: invalidate })

  const isLoadingAction =
    startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  return (
    <div>
      <div className="mb-4 flex justify-end sm:mb-6">
        <Button onClick={() => refetch()} disabled={isLoading} className="w-full sm:w-auto">
          Refresh
        </Button>
      </div>
      {error ? (
        <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
          Error loading VMs: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : (
        <VMList
          vms={vms}
          onStart={(id) => startMutation.mutate(id)}
          onStop={(id) => stopMutation.mutate(id)}
          onRestart={(id) => restartMutation.mutate(id)}
          isLoading={isLoadingAction}
        />
      )}
    </div>
  )
}

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

      {tab === "storage" ? <StorageView /> : <VMsTab />}
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
