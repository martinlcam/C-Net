/*
 * CPU rates for the host agent. Proxmox's own `cpu` fields are rates between two samples
 * held inside its long-lived daemon; a fresh `pvesh` process has no previous sample and
 * reports 0. The agent is long-lived, so it keeps the previous sample itself and diffs
 * /proc/stat (node) and each container's cgroup cpu.stat (guests). Pure functions, tested.
 */

export interface ProcStatCpu {
  idle: number
  iowait: number
  total: number
}

/** The aggregate `cpu` line of /proc/stat: user nice system idle iowait irq softirq steal. */
export function parseProcStatCpu(line: string): ProcStatCpu {
  const f = line.trim().split(/\s+/).slice(1, 9).map(Number)
  const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = f
  return { idle, iowait, total: user + nice + system + idle + iowait + irq + softirq + steal }
}

/** Busy and iowait fractions of all cores between two /proc/stat samples. */
export function procStatCpuRates(
  prev: ProcStatCpu,
  next: ProcStatCpu
): { cpu: number; iowait: number } {
  const total = next.total - prev.total
  if (total <= 0) return { cpu: 0, iowait: 0 }
  const idle = next.idle - prev.idle
  const iowait = next.iowait - prev.iowait
  // Time spent waiting on IO is not busy CPU; it counts with idle, as top does.
  return {
    cpu: Math.max(0, Math.min(1, 1 - (idle + iowait) / total)),
    iowait: Math.max(0, Math.min(1, iowait / total)),
  }
}

/**
 * A guest's CPU as a fraction of the cores it may use (Proxmox's convention), from two
 * cgroup `usage_usec` readings `dtMs` apart. Counter resets and zero intervals read as 0.
 */
export function cgroupCpuFraction(
  prevUsec: number,
  nextUsec: number,
  dtMs: number,
  cores: number
): number {
  if (dtMs <= 0 || cores <= 0 || nextUsec < prevUsec) return 0
  const used = (nextUsec - prevUsec) / 1000 // ms of CPU time
  return Math.max(0, Math.min(1, used / (dtMs * cores)))
}
