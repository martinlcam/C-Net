CREATE TYPE "public"."bfida_board_kind" AS ENUM('english', 'european');--> statement-breakpoint
CREATE TABLE "bfida_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_initial" text NOT NULL,
	"board_kind" "bfida_board_kind" NOT NULL,
	"pegs_remaining" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
