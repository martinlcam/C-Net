import { db } from "@cnet/db"
import { partyEvents, partyGuests, users, vaultFiles, vaultUploads } from "@cnet/db/schema"
import type { JellyfinItem } from "@cnet/engine"
import { setWorldConstructor, World } from "@cucumber/cucumber"
import { eq, inArray } from "drizzle-orm"
import jwt from "jsonwebtoken"
import type { ItemTracksDTO } from "../../src/controllers/media.controller"

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
  vaultUserId: string | undefined
  uploadId: string | undefined
  uploadChunkSize = 0
  existingFileId: string | undefined
  // Media scenarios map a Jellyfin item straight through the tracks builder.
  jellyfinItem: JellyfinItem | undefined
  tracks: ItemTracksDTO | undefined

  headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (this.token) h.Authorization = `Bearer ${this.token}`
    return h
  }

  async get(path: string): Promise<HttpResult> {
    const r = await fetch(`${runtime.baseUrl}${path}`, { headers: this.headers() })
    this.res = { status: r.status, body: await r.json().catch(() => null) }
    return this.res
  }

  /** Insert (or reuse) a real users row so vault FKs hold, and sign a token for it. */
  async signInAsVaultUser(): Promise<void> {
    const email = "storage@bdd.local"
    const [row] = await db
      .insert(users)
      .values({ email, name: "BDD Storage" })
      .onConflictDoUpdate({ target: users.email, set: { name: "BDD Storage" } })
      .returning({ id: users.id })
    this.vaultUserId = row.id
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
    if (!secret) throw new Error("AUTH_SECRET missing")
    this.token = jwt.sign({ id: row.id, sub: row.id, email, name: "BDD Storage" }, secret, {
      expiresIn: "1h",
    })
  }

  async putRaw(path: string, body: Uint8Array): Promise<HttpResult> {
    const r = await fetch(`${runtime.baseUrl}${path}`, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/octet-stream" },
      body,
    })
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
    if (this.vaultUserId) {
      await db.delete(vaultUploads).where(eq(vaultUploads.ownerUserId, this.vaultUserId))
      await db.delete(vaultFiles).where(eq(vaultFiles.ownerUserId, this.vaultUserId))
    }
    this.uploadId = undefined
    this.eventIds = []
    this.guestIds.clear()
    this.token = undefined
  }
}

setWorldConstructor(InviteWorld)
