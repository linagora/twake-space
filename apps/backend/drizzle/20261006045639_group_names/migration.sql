CREATE TABLE "group_names" (
	"group_id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"renamed_at" timestamp with time zone NOT NULL
);
