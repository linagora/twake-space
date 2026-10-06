CREATE TABLE "feed_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"space_id" uuid NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"category" "feed_category" NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"latest_event_id" uuid NOT NULL,
	"latest_time" timestamp with time zone NOT NULL,
	CONSTRAINT "feed_cards_space_id_object_type_object_id_unique" UNIQUE("space_id","object_type","object_id")
);
--> statement-breakpoint
CREATE TABLE "feed_item_reactions" (
	"item_id" uuid,
	"space_id" uuid NOT NULL,
	"user_id" uuid,
	"key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_item_reactions_pkey" PRIMARY KEY("item_id","user_id","key")
);
--> statement-breakpoint
CREATE TABLE "feed_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"space_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "feed_cards_space_id_time_id_index" ON "feed_cards" ("space_id","time","id");--> statement-breakpoint
CREATE INDEX "feed_item_reactions_created_at_index" ON "feed_item_reactions" ("created_at");--> statement-breakpoint
CREATE INDEX "feed_posts_space_id_time_id_index" ON "feed_posts" ("space_id","time","id");--> statement-breakpoint
ALTER TABLE "feed_cards" ADD CONSTRAINT "feed_cards_latest_event_id_activity_events_id_fkey" FOREIGN KEY ("latest_event_id") REFERENCES "activity_events"("id") ON DELETE CASCADE;--> statement-breakpoint
-- The events already stored become cards, one per object.
INSERT INTO "feed_cards" ("space_id", "object_type", "object_id", "category", "time", "latest_event_id", "latest_time")
SELECT DISTINCT ON ("space_id", "object_type", "object_id")
  "space_id", "object_type", "object_id", "category",
  min("time") OVER (PARTITION BY "space_id", "object_type", "object_id"),
  "id", "time"
FROM "activity_events"
WHERE "space_id" IS NOT NULL
ORDER BY "space_id", "object_type", "object_id", "time" DESC, "created_at" DESC;