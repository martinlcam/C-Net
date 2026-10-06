-- Party invite seed. Copy, edit the names/details/link, then run:
--   psql "$DATABASE_URL" -f party-seed.sql
-- The event id is the secret in the URL: https://invite.martin.cam/<id>
-- Pick a fresh uuid for a real party (SELECT gen_random_uuid();).
-- Guest names must be unique within an event.
-- starts_at is a UTC instant; the page shows it in each viewer's local time.

INSERT INTO party_events (id, title, details, starts_at, location, group_chat_url) VALUES (
  '7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f',
  'Dressed for the Wrong Occasion',
  E'Black tie at a barbecue. Swimwear at a funeral. A wetsuit at a wedding.\n\nCome dressed for an occasion that this is not. Prizes for the most committed miss.\n\nBring a drink to share. Doors at seven, costumes mandatory, judgment guaranteed.',
  '2026-10-31 19:00:00+00',
  'Martin''s place — address in the group chat',
  'https://ig.me/j/REPLACE_ME'
);

INSERT INTO party_guests (event_id, name) VALUES
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Alex Example'),
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Blair Example'),
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Casey Example'),
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Devon Example'),
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Emery Example'),
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Finley Example'),
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Harper Example'),
  ('7f1b5c2e-3d4a-4b6c-9e8f-0a1b2c3d4e5f', 'Jordan Example');
