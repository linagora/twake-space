-- Rows from before user ids cannot be keyed. They come back with the next member event or reconciliation.
DELETE FROM "space_members";--> statement-breakpoint
DROP INDEX "space_members_username_index";--> statement-breakpoint
ALTER TABLE "space_members" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "space_members" DROP CONSTRAINT "space_members_pkey";--> statement-breakpoint
ALTER TABLE "space_members" ADD PRIMARY KEY ("space_id","user_id");--> statement-breakpoint
CREATE INDEX "space_members_user_id_index" ON "space_members" ("user_id");