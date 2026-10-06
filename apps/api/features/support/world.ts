import { db } from "@cnet/db"
import { partyEvents, partyGuests } from "@cnet/db/schema"
import { setWorldConstructor, World } from "@cucumber/cucumber"
import { eq, inArray } from "drizzle-orm"

export type HttpResult = { status: number; body: unknown }

/** Filled in by BeforeAll once the app has picked its ephemeral port. */
export const runtime = { baseUrl: "" }

type EventOverrides = Partial<{
  title: string
  details: string
  location: string
  groupChatUrl: string
}>

/** Per-scenario state: fixture ids and the last HTTP result. */
export class InviteWorld extends World {
  eventIds: string[] = []
  guestIds = new Map<string, string>()
  groupChatUrl = "https://ig.me/j/test-group-chat"
  token: string | undefined
  res: HttpResult = { status: 0, body: null }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (this.token) h.Authorization = `Bearer ${this.token}`
    return h
  }

  async get(path: string): Promise<HttpResult> {
    const r = await fetch(`${runtime.baseUrl}${path}`, { headers: this.headers() })
    this.res = { status: r.status, body: await r.json().catch(() => null) }
    return this.res
  }

  async post(path: string, body: unknown): Promise<HttpResult> {
    const r = await fetch(`${runtime.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    })
    this.res = { status: r.status, body: await r.json().catch(() => null) }
    return this.res
  }

  /** Insert an event plus unanswered guests; remembers ids for cleanup and lookups. */
  async createEvent(names: string[], overrides: EventOverrides = {}): Promise<string> {
    const [event] = await db
      .insert(partyEvents)
      .values({
        title: overrides.title ?? "Dressed for the Wrong Occasion",
        details: overrides.details ?? "Come as you are.\n\nBut wrong.",
        startsAt: new Date("2026-10-31T19:00:00Z"),
        location: overrides.location ?? "Martin's place",
        groupChatUrl: overrides.groupChatUrl ?? this.groupChatUrl,
      })
      .returning({ id: partyEvents.id })
    if (!event) throw new Error("event insert returned no row")
    this.eventIds.push(event.id)
    if (names.length > 0) {
      const guests = await db
        .insert(partyGuests)
        .values(names.map((name) => ({ eventId: event.id, name })))
        .returning({ id: partyGuests.id, name: partyGuests.name })
      for (const g of guests) this.guestIds.set(g.name, g.id)
    }
    return event.id
  }

  async markAnswered(name: string, rsvp: "yes" | "no", birthday: string): Promise<void> {
    const id = this.guestIds.get(name)
    if (!id) throw new Error(`Unknown fixture guest ${name}`)
    await db
      .update(partyGuests)
      .set({ rsvp, birthday, respondedAt: new Date() })
      .where(eq(partyGuests.id, id))
  }

  async guestRow(name: string) {
    const id = this.guestIds.get(name)
    if (!id) throw new Error(`Unknown fixture guest ${name}`)
    const [row] = await db.select().from(partyGuests).where(eq(partyGuests.id, id))
    if (!row) throw new Error(`Guest row for ${name} is gone`)
    return row
  }

  async cleanup(): Promise<void> {
    if (this.eventIds.length > 0) {
      await db.delete(partyEvents).where(inArray(partyEvents.id, this.eventIds))
    }
    this.eventIds = []
    this.guestIds.clear()
    this.token = undefined
  }
}

setWorldConstructor(InviteWorld)
