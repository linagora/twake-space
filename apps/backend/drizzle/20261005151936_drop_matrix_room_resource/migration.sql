ALTER TABLE "space_resources" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "space_resource_kind";--> statement-breakpoint
CREATE TYPE "space_resource_kind" AS ENUM('drive', 'mailbox', 'calendar', 'matrix_space');--> statement-breakpoint
ALTER TABLE "space_resources" ALTER COLUMN "kind" SET DATA TYPE "space_resource_kind" USING "kind"::"space_resource_kind";