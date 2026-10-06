import { date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { partyRsvpEnum } from "./enums"

/**
 * A party invite. The row id is the secret in the invite URL
 * (invite.martin.cam/<id>), so it is never listed publicly.
 */
export const partyEvents = pgTable("party_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  /** The party "post". Blank lines separate paragraphs. */
  details: text("details").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  location: text("location").notNull(),
  /** Instagram group chat invite link, revealed only after a "yes". */
  groupChatUrl: text("group_chat_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/** One row per invited name. `rsvp` is null until the guest answers. */
export const partyGuests = pgTable(
  "party_guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => partyEvents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rsvp: partyRsvpEnum("rsvp"),
    birthday: date("birthday", { mode: "string" }),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    eventNameIdx: uniqueIndex("party_guest_event_name_idx").on(t.eventId, t.name),
    eventIdx: index("party_guest_event_idx").on(t.eventId),
  })
)
