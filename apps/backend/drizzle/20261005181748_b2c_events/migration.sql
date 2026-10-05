ALTER TABLE "activity_events" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "organization_id" DROP NOT NULL;