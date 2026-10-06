CREATE TABLE "user_settings" (
	"email" text PRIMARY KEY,
	"nickname" text NOT NULL,
	"version" integer NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
