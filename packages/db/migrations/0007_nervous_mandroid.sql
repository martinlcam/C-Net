ALTER TYPE "public"."audit_action" ADD VALUE 'STORAGE_LOCATE' BEFORE 'CONFIG_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'STORAGE_SPINDOWN' BEFORE 'CONFIG_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'STORAGE_ZPOOL_REPLACE' BEFORE 'CONFIG_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'STORAGE_ZPOOL_OFFLINE' BEFORE 'CONFIG_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'STORAGE_ZPOOL_ONLINE' BEFORE 'CONFIG_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'STORAGE_ZPOOL_SCRUB' BEFORE 'CONFIG_UPDATED';