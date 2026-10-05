ALTER TABLE "api_tokens" DROP CONSTRAINT "api_tokens_owner";--> statement-breakpoint
DROP INDEX "api_tokens_organization_id_owner_username_index";--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "api_tokens" DROP COLUMN "owner_username";--> statement-breakpoint
CREATE INDEX "api_tokens_organization_id_account_id_index" ON "api_tokens" ("organization_id","account_id");--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_owner" CHECK (("owner_kind" = 'account') = ("account_id" is not null));
