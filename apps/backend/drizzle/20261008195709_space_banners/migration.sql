CREATE TABLE "space_banners" (
	"space_id" uuid PRIMARY KEY,
	"content_type" text NOT NULL,
	"image" bytea NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
