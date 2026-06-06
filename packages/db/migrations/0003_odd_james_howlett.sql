CREATE TABLE "sonar_hotspots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotspot_key" text NOT NULL,
	"rule_key" text NOT NULL,
	"security_category" text,
	"vulnerability_probability" text NOT NULL,
	"status" text NOT NULL,
	"resolution" text,
	"component" text NOT NULL,
	"file_path" text,
	"line" integer,
	"message" text NOT NULL,
	"assignee" text,
	"creation_date" timestamp,
	"update_date" timestamp,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sonar_hotspots_hotspot_key_unique" UNIQUE("hotspot_key")
);
--> statement-breakpoint
CREATE INDEX "sonar_hotspots_status_idx" ON "sonar_hotspots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sonar_hotspots_probability_idx" ON "sonar_hotspots" USING btree ("vulnerability_probability");