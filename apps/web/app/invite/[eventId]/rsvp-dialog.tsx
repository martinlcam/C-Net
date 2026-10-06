"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { useState } from "react"
import { InviteApiError, type InviteGuest, isPlausibleBirthday, sendRsvp } from "@/lib/invite-api"

type Props = {
  eventId: string
  guest: InviteGuest | null
  onClose: () => void
  /** Called once the server has recorded (or refused as duplicate) this guest's answer. */
  onAnswered: (guestId: string) => void
}

type Result = { attending: boolean; groupChatUrl: string | null } | { duplicate: true }

const choiceClass = (active: boolean) =>
  `flex-1 rounded-full border px-4 py-2 text-sm transition-colors ${
    active
      ? "border-black bg-black text-white"
      : "border-black bg-white text-black hover:bg-gray-100"
  }`

function ResultView({ result }: Readonly<{ result: Result }>) {
  if ("duplicate" in result) {
    return <p className="mt-4 text-gray-700">Looks like you already answered.</p>
  }
  if (!result.attending) {
    return <p className="mt-4 text-gray-700">We&apos;ll miss you.</p>
  }
  return (
    <div className="mt-4 space-y-4">
      <p className="text-gray-700">See you there.</p>
      {result.groupChatUrl ? (
        <a
          href={result.groupChatUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-full border border-black bg-white px-4 py-2.5 text-center text-black hover:bg-gray-100"
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
    if (!isPlausibleBirthday(birthday)) {
      setError("Enter your birthday as YYYY-MM-DD.")
      return
    }
    setSending(true)
    setError(null)
    try {
      const r = await sendRsvp(eventId, { guestId: guest.id, attending, birthday })
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

  const canSend = attending !== null && birthday.length === 10 && !sending

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
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black bg-white p-6 shadow-xl focus:outline-none">
          <Dialog.Title className="font-bold text-2xl tracking-tight">{guest?.name}</Dialog.Title>

          {result === null ? (
            <>
              <Dialog.Description className="mt-1 text-gray-600 text-sm">
                Are you coming?
              </Dialog.Description>
              <div className="mt-5 flex gap-3">
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
              <label className="mt-5 block text-gray-600 text-sm">
                <span>Your birthday</span>
                <input
                  type="date"
                  value={birthday}
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-black px-3 py-2 text-black"
                />
              </label>
              {error ? <p className="mt-3 text-red-600 text-sm">{error}</p> : null}
              <button
                type="button"
                disabled={!canSend}
                onClick={submit}
                className="mt-6 w-full rounded-full bg-black px-4 py-2.5 text-white disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </>
          ) : (
            <ResultView result={result} />
          )}

          <Dialog.Close className="mt-4 w-full text-center text-gray-500 text-sm hover:text-black">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
