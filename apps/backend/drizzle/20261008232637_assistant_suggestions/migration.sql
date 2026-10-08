ALTER TYPE "notification_type" ADD VALUE 'assistant_suggestion';--> statement-breakpoint
ALTER TYPE "token_scope" ADD VALUE 'notifications:write';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_external_id_idx" ON "notifications" ("user_id","external_id") WHERE "external_id" is not null;--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_one_source", ADD CONSTRAINT "notifications_one_source" CHECK (num_nonnulls("activity_event_id", "matrix_event_id", "external_id") = 1);