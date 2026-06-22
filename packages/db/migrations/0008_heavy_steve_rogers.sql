CREATE TABLE "jellyfin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"jellyfin_user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jellyfin_users_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "jellyfin_users" ADD CONSTRAINT "jellyfin_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;