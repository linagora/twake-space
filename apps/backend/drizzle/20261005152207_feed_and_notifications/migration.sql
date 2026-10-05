CREATE TYPE "feed_category" AS ENUM('messages', 'files', 'activities', 'events');--> statement-breakpoint
CREATE TYPE "notification_type" AS ENUM('card_mention', 'message_mention', 'assignment', 'invitation', 'attended_event_change', 'space_change');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"space_id" uuid,
	"type" text NOT NULL,
	"category" "feed_category" NOT NULL,
	"actor" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"matrix_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_messages" (
	"matrix_event_id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"space_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"content" jsonb NOT NULL,
	"origin_server_ts" timestamp with time zone NOT NULL,
	"edited_content" jsonb,
	"edited_at" timestamp with time zone,
	"redacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_reactions" (
	"matrix_event_id" text PRIMARY KEY,
	"target_event_id" text NOT NULL,
	"sender" text NOT NULL,
	"key" text NOT NULL,
	"redacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"email" text,
	"type" "notification_type",
	"enabled" boolean NOT NULL,
	CONSTRAINT "notification_settings_pkey" PRIMARY KEY("email","type")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"recipient" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"space_id" uuid,
	"activity_event_id" text,
	"matrix_event_id" text,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_one_source" CHECK (("activity_event_id" is null) <> ("matrix_event_id" is null))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"organization_id" text PRIMARY KEY,
	"domain" text NOT NULL,
	"chat_available" boolean DEFAULT false NOT NULL,
	"mail_available" boolean DEFAULT false NOT NULL,
	"homeserver_url" text,
	"matrix_server_name" text,
	"as_token" bytea,
	"hs_token" bytea,
	"hs_token_hash" text UNIQUE,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activity_events_unposted_idx" ON "activity_events" ("space_id","time") WHERE "matrix_event_id" is null and "space_id" is not null;--> statement-breakpoint
CREATE INDEX "activity_events_space_id_object_type_object_id_time_index" ON "activity_events" ("space_id","object_type","object_id","time");--> statement-breakpoint
CREATE INDEX "activity_events_created_at_index" ON "activity_events" ("created_at");--> statement-breakpoint
CREATE INDEX "feed_messages_created_at_index" ON "feed_messages" ("created_at");--> statement-breakpoint
CREATE INDEX "feed_reactions_created_at_index" ON "feed_reactions" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_activity_event_idx" ON "notifications" ("recipient","type","activity_event_id") WHERE "activity_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_matrix_event_idx" ON "notifications" ("recipient","type","matrix_event_id") WHERE "matrix_event_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" ("recipient",("read_at" is null),"created_at");--> statement-breakpoint
CREATE INDEX "notifications_created_at_index" ON "notifications" ("created_at");--> statement-breakpoint
CREATE INDEX "space_resources_kind_resource_id_index" ON "space_resources" ("kind","resource_id");