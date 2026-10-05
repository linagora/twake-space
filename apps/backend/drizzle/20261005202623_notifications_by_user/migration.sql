DROP INDEX "notifications_recipient_idx";--> statement-breakpoint
DROP INDEX "notifications_activity_event_idx";--> statement-breakpoint
DROP INDEX "notifications_matrix_event_idx";--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "recipient";--> statement-breakpoint
ALTER TABLE "notification_settings" ADD PRIMARY KEY ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_activity_event_idx" ON "notifications" ("user_id","type","activity_event_id") WHERE "activity_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_matrix_event_idx" ON "notifications" ("user_id","type","matrix_event_id") WHERE "matrix_event_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" ("user_id",("read_at" is null),"created_at");
