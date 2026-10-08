CREATE TABLE "space_marks" (
	"space_id" uuid,
	"user_id" uuid,
	"pinned_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	CONSTRAINT "space_marks_pkey" PRIMARY KEY("space_id","user_id")
);
