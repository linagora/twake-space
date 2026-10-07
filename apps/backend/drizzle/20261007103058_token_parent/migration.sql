ALTER TABLE "api_tokens" ADD COLUMN "parent_token_id" uuid;--> statement-breakpoint
CREATE INDEX "api_tokens_parent_token_id_index" ON "api_tokens" ("parent_token_id");--> statement-breakpoint
UPDATE "api_tokens" SET "parent_token_id" = substring("created_by" from 7)::uuid WHERE "created_by" ~ '^token:[0-9a-f-]{36}$';