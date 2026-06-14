CREATE TABLE "vault_directories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"parent_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"original_parent_id" uuid,
	"original_path" text
);
--> statement-breakpoint
CREATE TABLE "vault_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"directory_id" uuid,
	"filename" text NOT NULL,
	"size" bigint NOT NULL,
	"content_type" text NOT NULL,
	"thumb_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"original_directory_id" uuid
);
--> statement-breakpoint
CREATE TABLE "vault_item_metadata" (
	"user_id" uuid NOT NULL,
	"file_id" uuid,
	"dir_id" uuid,
	"starred_at" timestamp,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "vault_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"directory_id" uuid,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"expected_size" bigint NOT NULL,
	"chunk_size" bigint NOT NULL,
	"chunk_count" integer NOT NULL,
	"uploaded_bytes" bigint DEFAULT 0 NOT NULL,
	"received_chunks" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_chunk_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "vault_directories" ADD CONSTRAINT "vault_directories_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_directories" ADD CONSTRAINT "vault_directories_parent_id_vault_directories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vault_directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_files" ADD CONSTRAINT "vault_files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_files" ADD CONSTRAINT "vault_files_directory_id_vault_directories_id_fk" FOREIGN KEY ("directory_id") REFERENCES "public"."vault_directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_item_metadata" ADD CONSTRAINT "vault_item_metadata_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_item_metadata" ADD CONSTRAINT "vault_item_metadata_file_id_vault_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."vault_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_item_metadata" ADD CONSTRAINT "vault_item_metadata_dir_id_vault_directories_id_fk" FOREIGN KEY ("dir_id") REFERENCES "public"."vault_directories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_uploads" ADD CONSTRAINT "vault_uploads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vault_dir_owner_idx" ON "vault_directories" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "vault_dir_parent_idx" ON "vault_directories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "vault_dir_parent_path_idx" ON "vault_directories" USING btree ("parent_path");--> statement-breakpoint
CREATE INDEX "vault_dir_deleted_idx" ON "vault_directories" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "vault_file_owner_created_idx" ON "vault_files" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "vault_file_directory_idx" ON "vault_files" USING btree ("directory_id");--> statement-breakpoint
CREATE INDEX "vault_file_deleted_idx" ON "vault_files" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "vault_meta_file_idx" ON "vault_item_metadata" USING btree ("user_id","file_id");--> statement-breakpoint
CREATE INDEX "vault_meta_dir_idx" ON "vault_item_metadata" USING btree ("user_id","dir_id");--> statement-breakpoint
CREATE INDEX "vault_upload_owner_idx" ON "vault_uploads" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "vault_upload_last_chunk_idx" ON "vault_uploads" USING btree ("last_chunk_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_dir_owner_path_live" ON "vault_directories" ("owner_user_id","path") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vault_file_dir_name_owner_live" ON "vault_files" ("directory_id","filename","owner_user_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vault_file_root_name_owner_live" ON "vault_files" ("filename","owner_user_id") WHERE "deleted_at" IS NULL AND "directory_id" IS NULL;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "vault_file_filename_trgm" ON "vault_files" USING gin ("filename" gin_trgm_ops);