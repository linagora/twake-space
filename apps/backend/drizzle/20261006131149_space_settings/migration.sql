CREATE TYPE "space_tab" AS ENUM('feed', 'chat', 'tasks', 'drive', 'mail', 'calendar');--> statement-breakpoint
CREATE TABLE "space_settings" (
	"space_id" uuid PRIMARY KEY,
	"description" text DEFAULT '' NOT NULL,
	"color" text,
	"apps" "space_tab"[] NOT NULL
);
