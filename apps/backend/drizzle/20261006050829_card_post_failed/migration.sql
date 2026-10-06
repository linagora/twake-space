ALTER TABLE "activity_events" ADD COLUMN "post_failed_at" timestamp with time zone;--> statement-breakpoint
DROP INDEX "activity_events_unposted_idx";--> statement-breakpoint
CREATE INDEX "activity_events_unposted_idx" ON "activity_events" ("space_id","time") WHERE "matrix_event_id" is null and "post_failed_at" is null and "space_id" is not null;