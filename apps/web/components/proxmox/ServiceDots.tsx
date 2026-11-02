"use client"

import type { OverviewService } from "./overview-api"

/**
 * The pve daemons as a row of dots: green when running, hollow when stopped. On a
 * single node the cluster services (corosync, HA) are expected to be off, so a stopped
 * service is only amber when systemd says it should have started.
 */
export function ServiceDots({ services }: { services: OverviewService[] }) {
  if (services.length === 0) return null
  const running = services.filter((s) => s.running).length
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="text-neutral-70 tabular-nums">
        {running} of {services.length} services running
      </span>
      {services.map((s) => {
        const dot = s.running
          ? "bg-accent-green-60 border-accent-green-60"
          : s.enabled
            ? "border-yellow-500"
            : "border-neutral-40"
        return (
          <span
            key={s.name}
            className="flex items-center gap-1 text-neutral-50"
            title={`${s.description || s.name}: ${s.state}`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full border transition-colors duration-500 ${dot}`}
            />
            {s.name}
          </span>
        )
      })}
    </div>
  )
}
