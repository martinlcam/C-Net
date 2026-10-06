CREATE TYPE "public"."party_rsvp" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TABLE "party_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"location" text NOT NULL,
	"group_chat_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rsvp" "party_rsvp",
	"birthday" date,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "party_guests" ADD CONSTRAINT "party_guests_event_id_party_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."party_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "party_guest_event_name_idx" ON "party_guests" USING btree ("event_id","name");--> statement-breakpoint
CREATE INDEX "party_guest_event_idx" ON "party_guests" USING btree ("event_id");