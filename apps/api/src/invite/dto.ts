export type InviteGuestPublic = { id: string; name: string }

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
