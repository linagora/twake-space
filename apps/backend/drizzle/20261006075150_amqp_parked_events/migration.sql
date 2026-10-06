-- Events parked from Kafka topics cannot be replayed from RabbitMQ.
DELETE FROM "parked_events";--> statement-breakpoint
ALTER TABLE "parked_events" ADD COLUMN "exchange" text NOT NULL;--> statement-breakpoint
ALTER TABLE "parked_events" ADD COLUMN "routing_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "parked_events" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "parked_events" ADD COLUMN "body" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "topic";--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "value";--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "headers";--> statement-breakpoint
ALTER TABLE "parked_events" ADD PRIMARY KEY ("source","id");