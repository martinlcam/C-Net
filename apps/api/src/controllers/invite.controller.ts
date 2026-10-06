import { db } from "@cnet/db"
import { partyEvents, partyGuests } from "@cnet/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { Body, Controller, Get, Path, Post, Response, Route } from "tsoa"
import {
  type InviteError,
  type InvitePublic,
  type RsvpRequest,
  type RsvpResult,
  UUID_RE,
} from "../invite/dto"
import { isValidBirthday } from "../invite/validate"

const NOT_FOUND: InviteError = { error: "Not found." }

/**
 * Party invite + RSVP. Public routes are guarded only by the unguessable event id
 * in the URL; the birthday is a deterrent, not a check (see spec).
 */
@Route("invite")
export class InviteController extends Controller {
  /** GET /invite/{eventId} — the party post plus the names that have not answered. */
  @Get("{eventId}")
  @Response<InviteError>(404, "Unknown invite")
  public async getInvite(@Path() eventId: string): Promise<InvitePublic | InviteError> {
    if (!UUID_RE.test(eventId)) {
      this.setStatus(404)
      return NOT_FOUND
    }
    const event = await db.query.partyEvents.findFirst({ where: eq(partyEvents.id, eventId) })
    if (!event) {
      this.setStatus(404)
      return NOT_FOUND
    }
    const guests = await db
      .select({ id: partyGuests.id, name: partyGuests.name })
      .from(partyGuests)
      .where(and(eq(partyGuests.eventId, eventId), isNull(partyGuests.rsvp)))
      .orderBy(asc(partyGuests.name))

    return {
      id: event.id,
      title: event.title,
      details: event.details,
      startsAt: event.startsAt.toISOString(),
      location: event.location,
      guests,
    }
  }

  /** POST /invite/{eventId}/rsvp — answer once; a yes reveals the group chat link. */
  @Post("{eventId}/rsvp")
  @Response<InviteError>(400, "Implausible birthday")
  @Response<InviteError>(404, "Unknown invite or guest")
  @Response<InviteError>(409, "Already answered")
  public async rsvp(
    @Path() eventId: string,
    @Body() body: RsvpRequest
  ): Promise<RsvpResult | InviteError> {
    if (!UUID_RE.test(eventId) || !UUID_RE.test(body.guestId)) {
      this.setStatus(404)
      return NOT_FOUND
    }
    if (!isValidBirthday(body.birthday)) {
      this.setStatus(400)
      return { error: "Enter your birthday as YYYY-MM-DD." }
    }

    const guest = await db.query.partyGuests.findFirst({
      where: and(eq(partyGuests.id, body.guestId), eq(partyGuests.eventId, eventId)),
    })
    if (!guest) {
      this.setStatus(404)
      return NOT_FOUND
    }
    if (guest.rsvp !== null) {
      this.setStatus(409)
      return { error: "This name has already responded." }
    }

    // The isNull guard makes a concurrent double-submit lose cleanly instead of overwriting.
    const updated = await db
      .update(partyGuests)
      .set({
        rsvp: body.attending ? "yes" : "no",
        birthday: body.birthday,
        respondedAt: new Date(),
      })
      .where(
        and(
          eq(partyGuests.id, body.guestId),
          eq(partyGuests.eventId, eventId),
          isNull(partyGuests.rsvp)
        )
      )
      .returning({ id: partyGuests.id })
    if (updated.length === 0) {
      this.setStatus(409)
      return { error: "This name has already responded." }
    }

    if (!body.attending) return { attending: false, groupChatUrl: null }
    const event = await db.query.partyEvents.findFirst({ where: eq(partyEvents.id, eventId) })
    return { attending: true, groupChatUrl: event?.groupChatUrl ?? null }
  }
}
