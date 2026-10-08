CREATE TABLE "feed_reads" (
	"space_id" uuid,
	"user_id" uuid,
	"read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "feed_reads_pkey" PRIMARY KEY("space_id","user_id")
);
