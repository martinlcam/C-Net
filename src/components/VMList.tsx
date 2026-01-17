import { VMCard } from './VMCard'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import type { ProxmoxVM } from '@/types/proxmox'

interface VMListProps {
  vms: ProxmoxVM[]
  onStart: (vmid: number) => void
  onStop: (vmid: number) => void
  onRestart: (vmid: number) => void
  isLoading?: boolean
}

export function VMList({ vms, onStart, onStop, onRestart, isLoading = false }: VMListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (vms.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-70 text-lg">No VMs or containers found</p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {vms.map((vm) => (
        <VMCard
          key={`${vm.node}-${vm.vmid}`}
          vm={vm}
          onStart={onStart}
          onStop={onStop}
          onRestart={onRestart}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}
