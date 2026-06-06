CREATE TABLE "sonar_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_key" text NOT NULL,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"issue_status" text,
	"resolution" text,
	"component" text NOT NULL,
	"file_path" text,
	"line" integer,
	"message" text NOT NULL,
	"effort" text,
	"tags" jsonb NOT NULL,
	"clean_code_attribute_category" text,
	"impacts" jsonb,
	"assignee" text,
	"creation_date" timestamp,
	"update_date" timestamp,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sonar_issues_issue_key_unique" UNIQUE("issue_key")
);
--> statement-breakpoint
CREATE INDEX "sonar_issues_status_idx" ON "sonar_issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sonar_issues_type_idx" ON "sonar_issues" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sonar_issues_resolution_idx" ON "sonar_issues" USING btree ("resolution");