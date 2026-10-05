CREATE TYPE "organization_role" AS ENUM('owner', 'admin', 'moderator', 'member');--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" text,
	"user_id" uuid,
	"email" text NOT NULL,
	"role" "organization_role" NOT NULL,
	CONSTRAINT "organization_members_pkey" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE INDEX "organization_members_user_id_index" ON "organization_members" ("user_id");