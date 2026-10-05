ALTER TABLE "space_groups" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "space_groups" ALTER COLUMN "group_id" SET DATA TYPE uuid USING "group_id"::uuid;