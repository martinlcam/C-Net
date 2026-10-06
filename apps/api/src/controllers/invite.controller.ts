import { db } from "@cnet/db"
import { partyEvents, partyGuests } from "@cnet/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { Controller, Get, Path, Response, Route } from "tsoa"
import { type InviteError, type InvitePublic, UUID_RE } from "../invite/dto"

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
}
