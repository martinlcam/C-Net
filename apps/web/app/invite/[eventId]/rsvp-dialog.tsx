"use client"

import * as Dialog from "@radix-ui/react-dialog"
import Image from "next/image"
import { useState } from "react"
import {
  InviteApiError,
  type InviteGuest,
  isPlausibleBirthday,
  parseBirthday,
  sendRsvp,
} from "@/lib/invite-api"

type Props = {
  eventId: string
  guest: InviteGuest | null
  onClose: () => void
  /** Called once the server has recorded (or refused as duplicate) this guest's answer. */
  onAnswered: (guestId: string) => void
}

type Result = { attending: boolean; groupChatUrl: string | null } | { duplicate: true }

const choiceClass = (active: boolean) =>
  `flex h-14 flex-1 items-center justify-center rounded-2xl border text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
    active
      ? "border-black bg-black text-white"
      : "border-gray-300 bg-white text-black hover:border-black"
  }`

const primaryClass =
  "flex h-14 w-full items-center justify-center rounded-2xl bg-black text-lg text-white transition-opacity disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"

/** Martin's response to anyone who picks No. */
function NoImage() {
  return (
    <Image
      src="/invite-assets/no.jpg"
      alt=""
      width={667}
      height={375}
      className="mt-5 w-full rounded-2xl"
      unoptimized
    />
  )
}

function ResultView({ result }: Readonly<{ result: Result }>) {
  if ("duplicate" in result) {
    return <p className="mt-6 text-[17px] text-gray-700">Looks like you already answered.</p>
  }
  if (!result.attending) {
    return <NoImage />
  }
  return (
    <div className="mt-6 space-y-5">
      <p className="text-[17px] text-gray-700">See you there.</p>
      {result.groupChatUrl ? (
        <a
          href={result.groupChatUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryClass}
        >
          Join the group chat
        </a>
      ) : null}
    </div>
  )
}

export function RsvpDialog({ eventId, guest, onClose, onAnswered }: Readonly<Props>) {
  const [attending, setAttending] = useState<boolean | null>(null)
  const [birthday, setBirthday] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  function reset() {
    setAttending(null)
    setBirthday("")
    setError(null)
    setSending(false)
    setResult(null)
  }

  async function submit() {
    if (!guest || attending === null) return
    const iso = parseBirthday(birthday)
    if (!iso || !isPlausibleBirthday(iso)) {
      setError("That doesn't look like a birthday. Try something like 31/10/1999.")
      return
    }
    setSending(true)
    setError(null)
    try {
      const r = await sendRsvp(eventId, { guestId: guest.id, attending, birthday: iso })
      setResult(r)
      onAnswered(guest.id)
    } catch (e) {
      if (e instanceof InviteApiError && e.status === 409) {
        setResult({ duplicate: true })
        onAnswered(guest.id)
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong.")
      }
    } finally {
      setSending(false)
    }
  }

  const canSend = attending !== null && birthday.trim().length >= 6 && !sending

  return (
    <Dialog.Root
      open={guest !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          reset()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="invite-overlay fixed inset-0 bg-black/40" />
        {/* A bottom sheet on phones, a centred card from the small breakpoint up. */}
        <Dialog.Content className="invite-sheet fixed inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-satoshi text-black shadow-2xl focus:outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:p-7">
          <div
            className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden"
            aria-hidden="true"
          />

          <Dialog.Title className="font-bold text-[1.75rem] leading-tight tracking-tight">
            {guest?.name}
          </Dialog.Title>

          {result === null ? (
            <>
              <Dialog.Description className="mt-1 text-[17px] text-gray-500">
                Are you coming?
              </Dialog.Description>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  className={choiceClass(attending === true)}
                  onClick={() => setAttending(true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={choiceClass(attending === false)}
                  onClick={() => setAttending(false)}
                >
                  No
                </button>
              </div>

              <label className="mt-6 block">
                <span className="text-gray-600">Your birthday</span>
                {/* Plain text on purpose: the native date picker misbehaves on iOS inside a
                    fixed bottom sheet. Any common format is accepted and normalised on send. */}
                <input
                  type="text"
                  value={birthday}
                  placeholder="e.g. 31/10/1999"
                  autoComplete="bday"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  onChange={(e) => setBirthday(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSend) submit()
                  }}
                  className="mt-2 block h-14 w-full rounded-2xl border border-gray-300 bg-white px-4 text-[17px] text-black placeholder:text-gray-400 focus:border-black focus:outline-none"
                />
              </label>

              {error ? <p className="mt-3 text-red-600">{error}</p> : null}

              <button
                type="button"
                disabled={!canSend}
                onClick={submit}
                className={`${primaryClass} mt-7`}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </>
          ) : (
            <ResultView result={result} />
          )}

          <Dialog.Close className="mt-4 flex h-12 w-full items-center justify-center text-gray-500 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
