"use client"

import { useQuery } from "@tanstack/react-query"
import { type AdminEvent, fetchInviteOverview } from "@/lib/invite-api"

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—"
}

function Counts({ event }: Readonly<{ event: AdminEvent }>) {
  const yes = event.guests.filter((g) => g.rsvp === "yes").length
  const no = event.guests.filter((g) => g.rsvp === "no").length
  const pending = event.guests.length - yes - no
  return (
    <p className="text-neutral-60 text-sm">
      {yes} yes · {no} no · {pending} pending
    </p>
  )
}

function EventTable({ event }: Readonly<{ event: AdminEvent }>) {
  return (
    <section className="mb-10">
      <div className="mb-3">
        <h2 className="font-semibold text-lg text-neutral-100">{event.title}</h2>
        <p className="text-neutral-60 text-sm">
          {fmt(event.startsAt)} · {event.location}
        </p>
        <Counts event={event} />
        <p className="mt-1 break-all font-mono text-neutral-50 text-xs">
          invite.martin.cam/{event.id}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-neutral-30 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-10 text-left text-neutral-60 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Answer</th>
              <th className="px-4 py-2">Birthday</th>
              <th className="px-4 py-2">Responded</th>
            </tr>
          </thead>
          <tbody>
            {event.guests.map((g) => (
              <tr key={g.id} className="border-neutral-20 border-t">
                <td className="px-4 py-2 text-neutral-100">{g.name}</td>
                <td className="px-4 py-2 text-neutral-70">{g.rsvp ?? "pending"}</td>
                <td className="px-4 py-2 text-neutral-70">{g.birthday ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-70">{fmt(g.respondedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function InvitesAdmin() {
  const overview = useQuery({
    queryKey: ["invite", "admin", "overview"],
    queryFn: fetchInviteOverview,
  })

  let body: React.ReactNode
  if (overview.error) {
    body = (
      <div className="rounded-lg border border-accent-red-30 bg-accent-red-10 p-4 text-accent-red-70">
        {overview.error instanceof Error ? overview.error.message : "Failed to load responses"}
      </div>
    )
  } else if (overview.isLoading || !overview.data) {
    body = <div className="py-12 text-center text-neutral-60">Loading…</div>
  } else if (overview.data.events.length === 0) {
    body = <div className="py-12 text-center text-neutral-60">No events yet.</div>
  } else {
    body = overview.data.events.map((event) => <EventTable key={event.id} event={event} />)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 font-bold text-2xl text-neutral-100 md:text-3xl">Party invites</h1>
      {body}
    </div>
  )
}
