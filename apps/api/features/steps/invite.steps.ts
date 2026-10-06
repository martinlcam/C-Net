import assert from "node:assert/strict"
import { type DataTable, Given, Then, When } from "@cucumber/cucumber"
import jwt from "jsonwebtoken"
import type { InviteWorld } from "../support/world"

type InviteBody = {
  id: string
  title: string
  details: string
  startsAt: string
  location: string
  guests: { id: string; name: string }[]
}

/** `"Ana", "Ben" and "Cy"` → ["Ana","Ben","Cy"]. */
function names(list: string): string[] {
  return [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

// Regex rather than {string} so one step covers "Ana", "Ana" and "Ben", and "Ana", "Ben" and "Cy".
Given(/^an event with guests (".+")$/, async function (this: InviteWorld, list: string) {
  await this.createEvent(names(list))
})

Given(
  "{string} has already answered {string} with birthday {string}",
  async function (this: InviteWorld, name: string, rsvp: string, birthday: string) {
    await this.markAnswered(name, rsvp as "yes" | "no", birthday)
  }
)

When("I open the invite", async function (this: InviteWorld) {
  await this.get(`/invite/${this.eventIds[0]}`)
})

When("I open the invite {string}", async function (this: InviteWorld, id: string) {
  await this.get(`/invite/${id}`)
})

Then("the response status is {int}", function (this: InviteWorld, status: number) {
  assert.equal(this.res.status, status, JSON.stringify(this.res.body))
})

Then("I see the title {string}", function (this: InviteWorld, title: string) {
  assert.equal((this.res.body as InviteBody).title, title)
})

Then("I see the details, time and location", function (this: InviteWorld) {
  const body = this.res.body as InviteBody
  assert.equal(body.details, "Come as you are.\n\nBut wrong.")
  assert.equal(body.startsAt, "2026-10-31T19:00:00.000Z")
  assert.equal(body.location, "Martin's place")
})

Then(/^I see the names (".+")$/, function (this: InviteWorld, list: string) {
  const got = (this.res.body as InviteBody).guests.map((g) => g.name)
  assert.deepEqual(got, names(list).sort())
})

Then("I do not see the name {string}", function (this: InviteWorld, name: string) {
  const got = (this.res.body as InviteBody).guests.map((g) => g.name)
  assert.ok(!got.includes(name), `${name} should be hidden`)
})

Then("I do not see the group chat link", function (this: InviteWorld) {
  assert.ok(!JSON.stringify(this.res.body).includes(this.groupChatUrl))
  assert.ok(!JSON.stringify(this.res.body).includes("birthday"))
})

type RsvpBody = { attending: boolean; groupChatUrl: string | null }

/** "today" / "tomorrow" → YYYY-MM-DD in UTC; anything else passes through. */
function resolveBirthday(raw: string): string {
  if (raw !== "today" && raw !== "tomorrow") return raw
  const d = new Date()
  if (raw === "tomorrow") d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

Given(/^a second event with guests (".+")$/, async function (this: InviteWorld, list: string) {
  await this.createEvent(names(list))
})

When(
  "{string} answers {string} with birthday {string}",
  async function (this: InviteWorld, name: string, rsvp: string, birthday: string) {
    const guestId = this.guestIds.get(name)
    const eventId = this.eventIds[this.eventIds.length - 1]
    await this.post(`/invite/${eventId}/rsvp`, {
      guestId,
      attending: rsvp === "yes",
      birthday: resolveBirthday(birthday),
    })
  }
)

When(
  "{string} answers {string} with birthday {string} through the first event's link",
  async function (this: InviteWorld, name: string, rsvp: string, birthday: string) {
    await this.post(`/invite/${this.eventIds[0]}/rsvp`, {
      guestId: this.guestIds.get(name),
      attending: rsvp === "yes",
      birthday: resolveBirthday(birthday),
    })
  }
)

When(
  "guest {string} answers {string} with birthday {string}",
  async function (this: InviteWorld, guestId: string, rsvp: string, birthday: string) {
    await this.post(`/invite/${this.eventIds[0]}/rsvp`, {
      guestId,
      attending: rsvp === "yes",
      birthday: resolveBirthday(birthday),
    })
  }
)

When(
  "{string} sends attending {string} with birthday {string}",
  async function (this: InviteWorld, name: string, attending: string, birthday: string) {
    await this.post(`/invite/${this.eventIds[0]}/rsvp`, {
      guestId: this.guestIds.get(name),
      attending,
      birthday,
    })
  }
)

Then("the response contains the group chat link", function (this: InviteWorld) {
  assert.equal((this.res.body as RsvpBody).groupChatUrl, this.groupChatUrl)
})

Then("the response does not contain the group chat link", function (this: InviteWorld) {
  assert.equal((this.res.body as RsvpBody).groupChatUrl, null)
})

Then(
  "{string} is stored as {string} with birthday {string}",
  async function (this: InviteWorld, name: string, rsvp: string, birthday: string) {
    const row = await this.guestRow(name)
    assert.equal(row.rsvp, rsvp)
    assert.equal(row.birthday, birthday)
    assert.ok(row.respondedAt instanceof Date)
  }
)

Then("{string} has not answered", async function (this: InviteWorld, name: string) {
  const row = await this.guestRow(name)
  assert.equal(row.rsvp, null)
  assert.equal(row.birthday, null)
  assert.equal(row.respondedAt, null)
})

type OverviewBody = {
  events: {
    id: string
    guests: {
      name: string
      rsvp: "yes" | "no" | null
      birthday: string | null
      respondedAt: string | null
    }[]
  }[]
}

Given("I am signed in as {string}", function (this: InviteWorld, email: string) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET missing")
  this.token = jwt.sign({ id: "bdd-user", sub: "bdd-user", email, name: "BDD" }, secret, {
    expiresIn: "1h",
  })
})

When("I request the responses overview", async function (this: InviteWorld) {
  await this.get("/invite/admin/overview")
})

Then("the overview lists my event with:", function (this: InviteWorld, table: DataTable) {
  const body = this.res.body as OverviewBody
  const event = body.events.find((e) => e.id === this.eventIds[0])
  assert.ok(event, "my event is in the overview")
  const got = event.guests.map((g) => ({
    name: g.name,
    rsvp: g.rsvp ?? "",
    birthday: g.birthday ?? "",
  }))
  assert.deepEqual(got, table.hashes())
  for (const g of event.guests) {
    assert.equal(typeof g.respondedAt === "string", g.rsvp !== null)
  }
})
