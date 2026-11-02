ALTER TYPE "feed_post_kind" ADD VALUE 'form';--> statement-breakpoint
ALTER TABLE "feed_poll_votes" ADD COLUMN "answers" jsonb;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "form_fields" jsonb;