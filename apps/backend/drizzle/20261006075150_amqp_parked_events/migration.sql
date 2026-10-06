ALTER TABLE "parked_events" ADD COLUMN "exchange" text;--> statement-breakpoint
ALTER TABLE "parked_events" ADD COLUMN "routing_key" text;--> statement-breakpoint
ALTER TABLE "parked_events" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "parked_events" ADD COLUMN "body" jsonb;--> statement-breakpoint
-- The platform topic carried no exchange: the one the queue binds each routing key on.
UPDATE "parked_events" SET
  "body" = "value"::jsonb,
  "exchange" = CASE
    WHEN "topic" <> 'twake.platform.events.v1' THEN 'activity'
    WHEN "headers"->>'amqp_routing_key' LIKE 'twake.space.%' THEN 'space'
    WHEN "headers"->>'amqp_routing_key' = 'dns.validated' THEN 'admin-panel'
    ELSE 'b2b'
  END,
  "routing_key" = CASE
    WHEN "topic" = 'twake.platform.events.v1' THEN "headers"->>'amqp_routing_key'
    ELSE "value"::jsonb->>'type'
  END,
  "message_id" = CASE
    WHEN "topic" = 'twake.platform.events.v1' THEN "headers"->>'amqp_message_id'
  END;--> statement-breakpoint
ALTER TABLE "parked_events" ALTER COLUMN "exchange" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parked_events" ALTER COLUMN "routing_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parked_events" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "topic";--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "value";--> statement-breakpoint
ALTER TABLE "parked_events" DROP COLUMN "headers";--> statement-breakpoint
ALTER TABLE "parked_events" ADD PRIMARY KEY ("source","id");
