import { Button } from "@/stories/button/button"
import { Badge } from "@/stories/badge/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/stories/card/card"
import type { ProxmoxVM } from "@/types/proxmox"

interface VMCardProps {
  vm: ProxmoxVM
  onStart: (vmid: number) => void
  onStop: (vmid: number) => void
  onRestart: (vmid: number) => void
  isLoading?: boolean
}

export function VMCard({ vm, onStart, onStop, onRestart, isLoading = false }: VMCardProps) {
  const statusColor =
    vm.status === "running" ? "success" : vm.status === "paused" ? "warning" : "destructive"

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-primary-purple-70">{vm.name || `VM ${vm.vmid}`}</CardTitle>
          <Badge variant={statusColor}>{vm.status}</Badge>
        </div>
        <CardDescription>
          VM ID: {vm.vmid} • Node: {vm.node} • Type: {vm.type || "qemu"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-neutral-70">
          <div className="flex justify-between">
            <span>CPU:</span>
            <span className="font-medium">{vm.cpu || 0} cores</span>
          </div>
          <div className="flex justify-between">
            <span>Memory:</span>
            <span className="font-medium">{(vm.maxmem || 0) / 1024 / 1024 / 1024} GB</span>
          </div>
          {vm.uptime ? (
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="font-medium">{Math.floor(vm.uptime / 3600)} hours</span>
            </div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        {vm.status === "running" ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onStop(vm.vmid)}
              disabled={isLoading}
            >
              Stop
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestart(vm.vmid)}
              disabled={isLoading}
            >
              Restart
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => onStart(vm.vmid)} disabled={isLoading}>
            Start
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
