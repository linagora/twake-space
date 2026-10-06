CREATE TABLE "parked_events" (
	"topic" text,
	"source" text,
	"id" text,
	"key" text,
	"value" text NOT NULL,
	"headers" jsonb NOT NULL,
	"reason" text NOT NULL,
	"parked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parked_events_pkey" PRIMARY KEY("topic","source","id")
);
