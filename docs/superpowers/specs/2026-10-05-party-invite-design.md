# Party invite + RSVP (`invite.martin.cam`) — design

**Date:** 2026-10-05
**Status:** approved in conversation; implementation plan to follow

## Goal

A private invite page for a Halloween party ("Dressed for the Wrong Occasion") at
`https://invite.martin.cam/<event-uuid>`. A guest opens the link, reads the party details,
finds their own name in a list, answers yes or no, enters their birthday, and their name
disappears from the list. A "yes" reveals the Instagram group chat link. Martin reads the
responses on a superuser-only page in the `/cnet` dashboard.

The random uuid in the URL is the only thing keeping strangers out. The birthday is a
deterrent and a data point for Martin, **not** a check against anything.

## Non-goals

- No per-guest links, no accounts, no email.
- No admin UI for adding guests or editing the party post. Both are seeded by SQL on the box.
- No undo for a guest who answered wrong. Martin fixes it in SQL.
- No multiple-events UI beyond the admin overview listing whatever events exist.

## Hosting and routing

Production is Cloudflare Tunnel → Caddy (`:80`, catch-all host) → Next.js on 3001, with
`/svc/*` stripped and forwarded to the API on 4000. The web app's API base is the relative
`/svc`, so an invite page on `invite.martin.cam` calls `invite.martin.cam/svc/...`, which is
same-origin and lands on the API with no CORS changes.

**Code changes (in repo):**

- `apps/web/proxy.ts`: when the request host starts with `invite.`, rewrite the URL path to
  `/invite<path>` (e.g. `invite.martin.cam/abc` → internal `/invite/abc`; bare `/` → `/invite`).
  Asset and API paths are untouched: the matcher already skips `_next/static`, `_next/image`
  and `favicon.ico`, and `/svc/*` never reaches Next in prod because Caddy routes it to the
  API first (in dev the API is on its own port). The existing storage-role redirect logic is
  unchanged.
- `apps/web/app/robots.ts`: add `disallow: ["/invite"]`.
- Invite pages set `robots: { index: false, follow: false }` metadata.

**Box changes (not in repo, recorded in `docs/RUNBOOK-proxmox-deploy.md`):**

1. `/etc/cloudflared/config.yml`: add `- hostname: invite.martin.cam` / `service: http://localhost:80`
   above the `http_status:404` fallback. `systemctl restart cloudflared`.
2. `cloudflared tunnel route dns cnet invite.martin.cam` (creates the proxied CNAME).

`martin.cam/invite/<uuid>` also works since it is the same route; that is fine and still
unguessable.

## Data model (`packages/db/src/schema`)

New file `party.ts` (exported from `schema/index.ts`), plus a new enum in `enums.ts`:

```ts
export const partyRsvpEnum = pgEnum("party_rsvp", ["yes", "no"])
```

```ts
partyEvents = pgTable("party_events", {
  id: uuid primary key defaultRandom   // the secret in the URL
  title: text not null                 // "Dressed for the Wrong Occasion"
  details: text not null               // the party "post"; blank lines separate paragraphs
  startsAt: timestamp not null
  location: text not null
  groupChatUrl: text not null          // Instagram group chat invite link, shown only on a yes
  createdAt: timestamp defaultNow not null
})

partyGuests = pgTable("party_guests", {
  id: uuid primary key defaultRandom
  eventId: uuid not null references partyEvents.id onDelete cascade
  name: text not null
  rsvp: partyRsvpEnum                  // null = not answered yet
  birthday: date                       // null until answered
  respondedAt: timestamp               // null until answered
  createdAt: timestamp defaultNow not null
}, unique(eventId, name), index(eventId))
```

A migration is generated with `bun run db:generate` and committed with the schema change
(per CLAUDE.md, migrations must be in the same commit).

### Seed

`scripts/party-seed.example.sql`, committed, with placeholder copy and placeholder guest
names. Inserts one event with a fixed example uuid and ~8 guests. Martin copies it, edits
names/details/link, and runs it on the box with `psql`. Locally it is applied to the Docker
Postgres for development and manual testing. The BDD scenarios do **not** depend on it; they
insert their own fixtures.

## API (`apps/api/src/controllers/invite.controller.ts`, `@Route("invite")`)

Follows the bfida controller: public endpoints, strict server-side validation, plain
`{ error }` bodies on failure. Pure validation lives in `apps/api/src/invite/validate.ts` so
the controller stays thin.

Declaration order matters for Express: the static `admin/overview` route is declared before
the `{eventId}` routes.

### `GET /invite/admin/overview` — superuser only

`@Security("jwt", ["superuser"])`. Returns every event with every guest:

```ts
{ events: [{ id, title, startsAt, location, guests: [{ id, name, rsvp: "yes"|"no"|null, birthday: "YYYY-MM-DD"|null, respondedAt: iso|null }] }] }
```

Guests ordered by name. Events ordered by `startsAt` desc.

### `GET /invite/{eventId}` — public

- `eventId` must be a uuid, else 404 (not 400: do not distinguish malformed from unknown).
- Unknown event → 404 `{ error: "Not found." }`.
- Returns:

```ts
{ id, title, details, startsAt, location, guests: [{ id, name }] }
```

`guests` contains **only** guests with `rsvp IS NULL`, ordered by name. The group chat URL and
all birthdays are never in this response.

### `POST /invite/{eventId}/rsvp` — public

Body:

```ts
{ guestId: string, attending: boolean, birthday: string /* YYYY-MM-DD */ }
```

Validation (in order, first failure wins, all 400 unless noted):

1. `eventId` and `guestId` must be uuids → otherwise 404 `Not found.`
2. `attending` must be a boolean → `attending must be true or false.`
3. `birthday` must match `^\d{4}-\d{2}-\d{2}$`, be a real calendar date, be on or after
   1900-01-01 and not in the future → `Enter your birthday as YYYY-MM-DD.`
4. Guest must exist **and** belong to `eventId` → otherwise 404 `Not found.`
5. Guest must have `rsvp IS NULL` → otherwise 409 `This name has already responded.`

On success, a single `UPDATE ... WHERE id = $guestId AND event_id = $eventId AND rsvp IS NULL`
sets `rsvp`, `birthday`, `respondedAt = now()`. If the update affects 0 rows (lost a race),
respond 409 as in step 5. Response 200:

```ts
{ attending: boolean, groupChatUrl: string | null }   // url only when attending === true
```

## Web — invite page (`apps/web/app/invite/...`)

Outside the `(portfolio)` route group so the portfolio header and footer do not render.

- `invite/layout.tsx`: `metadata.robots = { index: false, follow: false }`, white page,
  the same type scale and mono accents the portfolio uses. A reserved slot (empty `div` with a
  comment) at the top of the post for a Halloween graphic Martin adds later.
- `invite/page.tsx`: static "Nothing here." (what `invite.martin.cam/` shows).
- `invite/[eventId]/page.tsx`: server component that reads `params.eventId` and renders
  `InviteClient` with it.
- `invite/[eventId]/invite-client.tsx` (client): fetches `GET ${API_BASE}/invite/:id`.
  - Loading: minimal skeleton. 404/any error: the same "Nothing here." as the bare page.
  - Post: title, date/time + location line, `details` split on blank lines into paragraphs.
  - "Find your name": the remaining guests as buttons in a wrapping list. Empty list:
    "Everyone has answered."
  - Clicking a name opens a Radix Dialog (`@radix-ui/react-dialog`, already a dependency):
    guest name as heading, two toggle buttons **Yes** / **No**, a `<input type="date">`
    for birthday, and a **Send** button disabled until both are set. Client-side it pre-checks
    the same birthday rule; server errors show inline in the dialog.
  - On 200: dialog content swaps to the result. Yes → "See you there." plus a prominent link
    to `groupChatUrl` (`target="_blank" rel="noopener noreferrer"`). No → "We'll miss you."
    The guest is removed from the local list immediately. On 409 → "Looks like you already
    answered." and the name is removed as well.
- `invite/[eventId]/lib/api.ts`: `fetchInvite`, `sendRsvp` (same style as `bfida/lib/scores.ts`).

## Web — admin page

`apps/web/app/cnet/dashboard/admin/invites/page.tsx` (+ a client component), reachable from a
link on the existing Admin page. Calls `GET /svc/invite/admin/overview` with the session
cookie (existing `credentials: "include"` pattern). Per event: title, when/where, counts
(yes / no / pending), then a table: Name, Answer, Birthday, Responded. Read-only.

The existing proxy rule already keeps `storage`-role users off `/cnet/dashboard/admin/*`,
and the API enforces the `superuser` scope.

## Testing — BDD scenarios

No unit tests. Behaviour is specified as Given/When/Then scenarios in `bun:test`, run against
the real Express app (`createApp()` listening on an ephemeral port) and the local Docker
Postgres, after migrations. File: `apps/api/src/invite/invite.feature.test.ts`. Each scenario
inserts its own event/guests in `beforeEach` and deletes them in `afterEach`, so the seed
file is not required.

Scenario list (the `describe` names are the Feature/Scenario, the `it` names are the steps):

**Feature: a guest opens the invite**
- Given an event with three unanswered guests, When the invite is fetched, Then it contains
  the title, details, time, location and the three names, and does not contain the group
  chat URL or any birthday.
- Given a guest who has already answered, When the invite is fetched, Then that name is absent.
- Given an unknown or malformed event id, When the invite is fetched, Then the response is 404.

**Feature: a guest answers yes**
- Given an unanswered guest, When they send attending=true with a valid birthday, Then the
  response is 200 with the group chat URL, the guest's rsvp/birthday/respondedAt are stored,
  and a subsequent invite fetch no longer lists them.

**Feature: a guest answers no**
- When they send attending=false, Then the response is 200 with `groupChatUrl: null`, the
  answer is stored, and the name is gone from the invite.

**Feature: an answer cannot be changed or reused**
- Given a guest who has answered, When another rsvp is sent for them, Then 409 and the stored
  answer is unchanged.
- Given a guest of event A, When an rsvp is sent through event B's id, Then 404 and nothing
  is stored.

**Feature: the birthday deterrent**
- When the birthday is not YYYY-MM-DD / not a real date (2026-02-30) / before 1900 / in the
  future, Then 400 and the guest remains unanswered.

**Feature: Martin reviews responses**
- Given no session, When the overview is requested, Then 401.
- Given a non-superuser session, Then 403.
- Given a superuser session, Then 200 listing every guest with their answer and birthday.

Sessions are minted in the test with `jsonwebtoken` and `AUTH_SECRET`, using an email that
is or is not in `VAULT_ALLOWLIST` (set for the test process).

Running: `bun test` inside `apps/api` with `DATABASE_URL` pointing at the Docker Postgres
(the test file skips itself with a clear message if `DATABASE_URL` is unset so CI, which has
no database, stays green).

The pages are verified by hand against the seed data in local Docker, then after deploy
against the public URL.

## Rollout

1. Branch `feat/party-invite` off `main`; commit in small steps (schema + migration, API +
   scenarios, invite page, admin page, routing + docs, seed).
2. Gates: `bun run lint:check`, `bunx turbo build`, `bun test` in `apps/api` with the DB up.
3. PR, merge to `main` → deploy runs on the box (migrations apply via `deploy.sh`).
4. On the box: tunnel ingress + DNS route (above), then seed the real event and guests with
   psql from Martin's edited copy of the seed file.
5. Verify: `curl https://invite.martin.cam/<uuid>` is 200, the bare host is the "Nothing
   here." page, `GET /svc/invite/<uuid>` returns the names, admin page lists them.
