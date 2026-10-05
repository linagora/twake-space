ALTER TABLE "activity_events" ALTER COLUMN "actor" SET DATA TYPE jsonb USING "actor"::jsonb;--> statement-breakpoint
ALTER TABLE "activity_events" ALTER COLUMN "actor" DROP NOT NULL;