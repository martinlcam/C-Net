ALTER TABLE "vault_files" ADD COLUMN "source_modified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vault_uploads" ADD COLUMN "source_modified_at" timestamp with time zone;