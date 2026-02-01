"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { VMList } from "@/components/VMList"
import { Button } from "@/stories/button/button"
import type { ProxmoxVM } from "@/types/proxmox"

async function fetchVMs(): Promise<ProxmoxVM[]> {
  const response = await fetch("/api/proxmox/vms")
  if (!response.ok) {
    throw new Error("Failed to fetch VMs")
  }
  const data = await response.json()
  return data.data || []
}

async function startVM(vmid: number): Promise<{ success: boolean; taskId: string }> {
  const response = await fetch(`/api/proxmox/vms/${vmid}/start`, {
    method: "POST",
  })
  if (!response.ok) {
    throw new Error("Failed to start VM")
  }
  return response.json()
}

async function stopVM(vmid: number): Promise<{ success: boolean; taskId: string }> {
  const response = await fetch(`/api/proxmox/vms/${vmid}/stop`, {
    method: "POST",
  })
  if (!response.ok) {
    throw new Error("Failed to stop VM")
  }
  return response.json()
}

async function restartVM(vmid: number): Promise<{ success: boolean; taskId: string }> {
  const response = await fetch(`/api/proxmox/vms/${vmid}/restart`, {
    method: "POST",
  })
  if (!response.ok) {
    throw new Error("Failed to restart VM")
  }
  return response.json()
}

export default function ProxmoxPage() {
  const queryClient = useQueryClient()

  const {
    data: vms = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["proxmox", "vms"],
    queryFn: fetchVMs,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const startMutation = useMutation({
    mutationFn: startVM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxmox", "vms"] })
    },
  })

  const stopMutation = useMutation({
    mutationFn: stopVM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxmox", "vms"] })
    },
  })

  const restartMutation = useMutation({
    mutationFn: restartVM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proxmox", "vms"] })
    },
  })

  const handleStart = (vmid: number) => {
    startMutation.mutate(vmid)
  }

  const handleStop = (vmid: number) => {
    stopMutation.mutate(vmid)
  }

  const handleRestart = (vmid: number) => {
    restartMutation.mutate(vmid)
  }

  const isLoadingAction =
    startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-primary-purple-80">Proxmox VMs & Containers</h1>
        <Button onClick={() => refetch()} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="bg-accent-red-10 border border-accent-red-30 rounded-lg p-4 text-accent-red-70">
          Error loading VMs: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : (
        <VMList
          vms={vms}
          onStart={handleStart}
          onStop={handleStop}
          onRestart={handleRestart}
          isLoading={isLoadingAction}
        />
      )}
    </div>
  )
}
