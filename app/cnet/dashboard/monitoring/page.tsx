"use client"

import { useQuery } from "@tanstack/react-query"
import { MetricsCard } from "@/components/MetricsCard"
import { LoadingSpinner } from "@/stories/loading-spinner/loading-spinner"
import type { NodeMetrics } from "@/types/proxmox"

async function fetchMetrics(): Promise<{ nodes: NodeMetrics[]; timestamp: string }> {
  const response = await fetch("/api/metrics/current")
  if (!response.ok) {
    throw new Error("Failed to fetch metrics")
  }
  const data = await response.json()
  return data.data
}

export default function MonitoringPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", "current"],
    queryFn: fetchMetrics,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-accent-red-10 border border-accent-red-30 rounded-lg p-4 text-accent-red-70">
        Error loading metrics: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  const nodes = data?.nodes || []
  const primaryNode = nodes[0]

  if (!primaryNode) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-70 text-lg">No metrics data available</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-4xl font-bold text-primary-purple-80 mb-8">Monitoring</h1>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <MetricsCard
          title="CPU Usage"
          value={primaryNode.cpu.usage}
          unit="%"
          subtitle={`Node: ${primaryNode.node}`}
          variant={
            primaryNode.cpu.usage > 80
              ? "destructive"
              : primaryNode.cpu.usage > 60
                ? "warning"
                : "success"
          }
        />
        <MetricsCard
          title="Memory Usage"
          value={primaryNode.memory.percent}
          unit="%"
          subtitle={`${(primaryNode.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB / ${(primaryNode.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`}
          variant={
            primaryNode.memory.percent > 80
              ? "destructive"
              : primaryNode.memory.percent > 60
                ? "warning"
                : "success"
          }
        />
        <MetricsCard
          title="Disk Usage"
          value={primaryNode.disk.percent}
          unit="%"
          subtitle={`${(primaryNode.disk.used / 1024 / 1024 / 1024).toFixed(2)} GB / ${(primaryNode.disk.total / 1024 / 1024 / 1024).toFixed(2)} GB`}
          variant={
            primaryNode.disk.percent > 80
              ? "destructive"
              : primaryNode.disk.percent > 60
                ? "warning"
                : "success"
          }
        />
      </div>

      {nodes.length > 1 ? (
        <div className="bg-white rounded-lg border border-neutral-30 p-6">
          <h2 className="text-2xl font-semibold text-primary-purple-70 mb-4">All Nodes</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {nodes.map((node) => (
              <div key={node.node} className="border border-neutral-30 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-primary-purple-60 mb-2">{node.node}</h3>
                <div className="space-y-2 text-sm text-neutral-70">
                  <div>CPU: {node.cpu.usage.toFixed(1)}%</div>
                  <div>Memory: {node.memory.percent.toFixed(1)}%</div>
                  <div>Disk: {node.disk.percent.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
