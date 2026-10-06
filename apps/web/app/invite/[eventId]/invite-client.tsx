"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { fetchInvite, type InviteGuest } from "@/lib/invite-api"
import { NothingHere } from "../nothing-here"
import { RsvpDialog } from "./rsvp-dialog"

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InviteClient({ eventId }: Readonly<{ eventId: string }>) {
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
    <main className="mx-auto w-full max-w-xl px-5 pt-14 pb-[max(3rem,env(safe-area-inset-bottom))] sm:pt-24">
      <article>
        {/* Halloween graphic goes here later. */}
        <div aria-hidden="true" />

        <p className="text-gray-500">You&apos;re invited</p>
        <h1 className="mt-3 font-bold text-[clamp(2.5rem,11vw,4.5rem)] text-black leading-[0.95] tracking-[-0.03em]">
          {title}
        </h1>

        <div className="mt-7 space-y-1 text-[17px] text-black leading-snug">
          <p>{formatWhen(startsAt)}</p>
          <p className="text-gray-600">{location}</p>
        </div>

        <a
          href="#names"
          className="mt-6 inline-block text-black underline decoration-gray-300 underline-offset-[6px] transition-colors hover:decoration-black"
        >
          Find your name
        </a>

        <div className="mt-10 space-y-5 text-[17px] text-gray-700 leading-[1.6]">
          {details.split(/\n\s*\n/).map((para) => (
            <p key={para}>{para}</p>
          ))}
        </div>
      </article>

      <section id="names" className="mt-14 scroll-mt-8">
        <h2 className="font-bold text-2xl text-black tracking-tight">Find your name</h2>
        <p className="mt-1 text-gray-500">Tap yours to answer.</p>

        {remaining.length === 0 ? (
          <p className="mt-6 text-gray-500">Everyone has answered.</p>
        ) : (
          <ul className="mt-5 border-gray-200 border-t sm:grid sm:grid-cols-2 sm:gap-x-8">
            {remaining.map((g) => (
              <li key={g.id} className="border-gray-200 border-b">
                <button
                  type="button"
                  onClick={() => setSelected(g)}
                  className="flex min-h-[52px] w-full items-center justify-between gap-4 py-3 text-left text-[17px] text-black transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                >
                  <span className="min-w-0 truncate">{g.name}</span>
                  <ChevronRight className="size-5 shrink-0 text-gray-400" aria-hidden="true" />
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
