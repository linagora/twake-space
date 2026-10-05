CREATE TABLE "homeservers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"url" text NOT NULL,
	"server_name" text NOT NULL,
	"as_token" bytea NOT NULL,
	"hs_token" bytea NOT NULL,
	"hs_token_hash" text NOT NULL UNIQUE,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_hs_token_hash_key";--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "source" text NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "event_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "homeserver_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "homeserver_url";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "matrix_server_name";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "as_token";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "hs_token";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "hs_token_hash";--> statement-breakpoint
ALTER TABLE "activity_events" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "activity_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "activity_event_id" SET DATA TYPE uuid USING "activity_event_id"::uuid;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_source_event_id_unique" UNIQUE("source","event_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_homeserver_id_homeservers_id_fkey" FOREIGN KEY ("homeserver_id") REFERENCES "homeservers"("id");