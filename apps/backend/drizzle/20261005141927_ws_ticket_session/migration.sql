ALTER TABLE "ws_tickets" ADD COLUMN "sid" text NOT NULL;--> statement-breakpoint
ALTER TABLE "ws_tickets" ADD COLUMN "token_expires_at" timestamp with time zone NOT NULL;