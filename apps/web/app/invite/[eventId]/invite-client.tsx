"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { fetchInvite, type InviteGuest } from "@/lib/invite-api"
import { NothingHere } from "../nothing-here"
import { RsvpDialog } from "./rsvp-dialog"

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InviteClient({ eventId }: { eventId: string }) {
  const [selected, setSelected] = useState<InviteGuest | null>(null)
  const [answered, setAnswered] = useState<Set<string>>(new Set())

  const invite = useQuery({
    queryKey: ["invite", eventId],
    queryFn: () => fetchInvite(eventId),
    retry: false,
  })

  if (invite.isLoading) {
    return <main className="min-h-screen" aria-busy="true" />
  }
  if (invite.isError || !invite.data) {
    return <NothingHere />
  }

  const { title, details, startsAt, location, guests } = invite.data
  const remaining = guests.filter((g) => !answered.has(g.id))

  return (
    <main className="px-6 py-16 sm:px-10 md:px-12 md:py-24 lg:px-20">
      <article className="max-w-3xl">
        {/* Halloween graphic goes here later. */}
        <div aria-hidden="true" />

        <p className="mb-6 text-gray-500 text-sm uppercase tracking-[0.3em]">You&apos;re invited</p>
        <h1 className="mb-8 font-bold text-[44px] text-black leading-[0.95] tracking-tight sm:text-[64px] md:text-[80px]">
          {title}
        </h1>
        <p className="mb-8 text-gray-500 text-sm">
          {formatWhen(startsAt)} · {location}
        </p>
        <div className="space-y-5 text-base text-gray-700 leading-relaxed md:text-lg">
          {details.split(/\n\s*\n/).map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
      </article>

      <section className="mt-16 max-w-3xl">
        <h2 className="mb-5 text-gray-500 text-sm uppercase tracking-[0.3em]">Find your name</h2>
        {remaining.length === 0 ? (
          <p className="text-gray-500">Everyone has answered.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {remaining.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setSelected(g)}
                  className="rounded-full border border-black bg-white px-4 py-2 text-black transition-colors hover:bg-gray-100"
                >
                  {g.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RsvpDialog
        eventId={eventId}
        guest={selected}
        onClose={() => setSelected(null)}
        onAnswered={(id) => setAnswered((prev) => new Set(prev).add(id))}
      />
    </main>
  )
}
