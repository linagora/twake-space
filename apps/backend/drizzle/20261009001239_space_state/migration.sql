CREATE TYPE "space_state" AS ENUM('active', 'archived', 'trashed');--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "state" "space_state" DEFAULT 'active'::"space_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "created_by" text;