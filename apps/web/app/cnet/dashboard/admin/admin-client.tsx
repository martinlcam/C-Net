"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { adminListDir, adminUsers } from "@/lib/vault-api"
import { Button } from "@/stories/button/button"
import { formatBytes } from "../_components/format"

export function AdminVault() {
  const [selected, setSelected] = useState<{ userId: string; email: string } | null>(null)
  const usersQuery = useQuery({ queryKey: ["vault", "admin", "users"], queryFn: adminUsers })
  const browseQuery = useQuery({
    queryKey: ["vault", "admin", "dir", selected?.userId],
    queryFn: () => adminListDir(selected?.userId ?? ""),
    enabled: selected !== null,
  })

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 font-bold text-2xl text-neutral-100 md:text-3xl">Vault Admin</h1>

      {usersQuery.error ? (
        <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
          {usersQuery.error instanceof Error ? usersQuery.error.message : "Failed to load users"}
        </div>
      ) : usersQuery.isLoading ? (
        <div className="py-12 text-center text-neutral-60">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-30 bg-white">
          <div className="hidden border-neutral-20 border-b bg-neutral-10 px-4 py-2 font-semibold text-neutral-60 text-xs uppercase tracking-wide md:flex">
            <span className="flex-1">User</span>
            <span className="w-24">Role</span>
            <span className="w-28 text-right">Usage</span>
            <span className="w-28 text-right">Quota</span>
            <span className="w-24" />
          </div>
          {usersQuery.data?.users.map((u) => (
            <div
              key={u.email}
              className="border-neutral-20 border-b px-4 py-3 last:border-b-0 md:flex md:items-center"
            >
              <div className="mb-3 flex items-start justify-between gap-3 md:mb-0 md:flex-1 md:items-center">
                <span className="min-w-0 flex-1 truncate text-neutral-100">{u.email}</span>
                <span className="shrink-0 text-neutral-70 text-sm md:hidden">{u.role}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm md:contents">
                <span className="hidden w-24 text-neutral-70 md:inline">{u.role}</span>
                <span className="text-neutral-70 md:w-28 md:text-right">
                  <span className="text-neutral-50 text-xs uppercase tracking-wide md:hidden">
                    Usage
                  </span>
                  <span className="block md:inline">{formatBytes(u.usageBytes)}</span>
                </span>
                <span className="text-neutral-70 md:w-28 md:text-right">
                  <span className="text-neutral-50 text-xs uppercase tracking-wide md:hidden">
                    Quota
                  </span>
                  <span className="block md:inline">{formatBytes(u.quotaBytes)}</span>
                </span>
                <span className="col-span-2 md:col-auto md:w-24 md:text-right">
                  {u.userId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setSelected({ userId: u.userId as string, email: u.email })}
                    >
                      Browse
                    </Button>
                  ) : (
                    <span className="text-neutral-50 text-xs">never signed in</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected ? (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold text-neutral-100 text-xl">{selected.email} — root</h2>
          {browseQuery.isLoading ? (
            <div className="py-8 text-center text-neutral-60">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-30 bg-white">
              {browseQuery.data?.directories.map((d) => (
                <div
                  key={d.id}
                  className="border-neutral-20 border-b px-4 py-2 text-neutral-100 last:border-b-0"
                >
                  📁 {d.name}
                </div>
              ))}
              {browseQuery.data?.files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center border-neutral-20 border-b px-4 py-2 last:border-b-0"
                >
                  <span className="flex-1 truncate text-neutral-100">{f.filename}</span>
                  <span className="text-neutral-70 text-sm">{formatBytes(f.size)}</span>
                </div>
              ))}
              {(browseQuery.data?.directories.length ?? 0) === 0 &&
              (browseQuery.data?.files.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-neutral-60">Empty</div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
