CREATE TABLE "feed_poll_choices" (
	"post_id" uuid,
	"user_id" uuid,
	"option" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_poll_choices_pkey" PRIMARY KEY("post_id","user_id","option")
);
--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "poll_multiple" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "poll_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_poll_choices" ADD CONSTRAINT "feed_poll_choices_post_id_feed_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE;