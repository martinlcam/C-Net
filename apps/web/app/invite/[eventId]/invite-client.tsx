"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Search } from "lucide-react"
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

function matches(name: string, query: string): boolean {
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
}

export function InviteClient({ eventId }: Readonly<{ eventId: string }>) {
  const [selected, setSelected] = useState<InviteGuest | null>(null)
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")

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
  const titleWords = title.trim().split(/\s+/)
  const titleLast = titleWords.pop() ?? ""
  const titleHead = titleWords.join(" ")
  const shown = query.trim() ? remaining.filter((g) => matches(g.name, query)) : remaining

  let list: React.ReactNode
  if (remaining.length === 0) {
    list = <p className="mt-6 text-gray-500">Everyone has answered.</p>
  } else if (shown.length === 0) {
    list = (
      <p className="mt-6 text-gray-500">
        No one by that name. Check the spelling, or ask Martin to add you.
      </p>
    )
  } else {
    list = (
      <ul className="mt-4 border-black/10 border-t sm:grid sm:grid-cols-2 sm:gap-x-8">
        {shown.map((g) => (
          <li key={g.id} className="border-black/10 border-b">
            <button
              type="button"
              onClick={() => setSelected(g)}
              className="flex min-h-[52px] w-full items-center justify-between gap-4 py-3 text-left text-[17px] text-black transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf6f1]"
            >
              <span className="min-w-0 truncate">{g.name}</span>
              <ChevronRight className="size-5 shrink-0 text-gray-400" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-14 pb-[max(3rem,env(safe-area-inset-bottom))] sm:pt-24">
      <article>
        {/* Halloween graphic goes here later. */}
        <div aria-hidden="true" />

        <p className="text-gray-500">You&apos;re invited</p>
        <h1 className="mt-3 font-bold text-[clamp(2.5rem,10vw,4rem)] text-black leading-[0.95] tracking-[-0.03em]">
          {titleHead}{" "}
          {/* The purple dot is the title's full stop. It is glued to the last word so it can
              never wrap onto a line of its own. */}
          <span className="whitespace-nowrap">
            {titleLast}
            <span
              className="ml-[0.06em] inline-block size-[0.16em] rounded-full bg-[#bea9e9] align-baseline"
              aria-hidden="true"
            />
          </span>
        </h1>

        <div className="mt-7 space-y-1 text-[17px] text-black leading-snug">
          <p>{formatWhen(startsAt)}</p>
          <p className="text-gray-600">{location}</p>
        </div>

        <a
          href="#names"
          className="mt-6 inline-block text-black underline decoration-black/20 underline-offset-[6px] transition-colors hover:decoration-black"
        >
          Find your name
        </a>

        <div className="mt-10 space-y-5 text-[17px] text-gray-700 leading-[1.6]">
          {details.split(/\n\s*\n/).map((para) => (
            <p key={para}>
              {para.split("\n").map((line, i) => (
                <span key={line}>
                  {i > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          ))}
        </div>
      </article>

      <section id="names" className="mt-14 scroll-mt-8">
        <h2 className="font-bold text-2xl text-black tracking-tight">Find your name</h2>
        <p className="mt-1 text-gray-500">Tap yours to answer.</p>

        {remaining.length > 0 ? (
          <label className="relative mt-5 block">
            <span className="sr-only">Search names</span>
            <Search
              className="-translate-y-1/2 absolute top-1/2 left-4 size-5 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names"
              autoComplete="off"
              className="h-12 w-full rounded-full border border-black/15 bg-white pr-4 pl-12 text-[17px] text-black placeholder:text-gray-400 focus:border-black focus:outline-none"
            />
          </label>
        ) : null}

        {list}
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
