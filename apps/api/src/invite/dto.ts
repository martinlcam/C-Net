/** `rsvp` is "yes" for a guest who is going, null while unanswered; "no" answers are not listed. */
export type InviteGuestPublic = { id: string; name: string; rsvp: "yes" | null }

/** What a guest sees. Never includes the group chat link or any birthday. */
export type InvitePublic = {
  id: string
  title: string
  details: string
  startsAt: string
  location: string
  guests: InviteGuestPublic[]
}

export type InviteError = { error: string }

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RsvpRequest = {
  guestId: string
  attending: boolean
  /** YYYY-MM-DD */
  birthday: string
}

/** `groupChatUrl` is set only when `attending` is true. */
export type RsvpResult = { attending: boolean; groupChatUrl: string | null }

export type AdminGuest = {
  id: string
  name: string
  rsvp: "yes" | "no" | null
  birthday: string | null
  respondedAt: string | null
}

export type AdminEvent = {
  id: string
  title: string
  startsAt: string
  location: string
  guests: AdminGuest[]
}

export type AdminOverview = { events: AdminEvent[] }
