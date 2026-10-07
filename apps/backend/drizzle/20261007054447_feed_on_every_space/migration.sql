ALTER TABLE "space_settings" ALTER COLUMN "apps" SET DATA TYPE text[];--> statement-breakpoint
UPDATE "space_settings" SET "apps" = array_remove("apps", 'feed');--> statement-breakpoint
DROP TYPE "space_tab";--> statement-breakpoint
CREATE TYPE "space_tab" AS ENUM('chat', 'tasks', 'drive', 'mail', 'calendar');--> statement-breakpoint
ALTER TABLE "space_settings" ALTER COLUMN "apps" SET DATA TYPE "space_tab"[] USING "apps"::"space_tab"[];