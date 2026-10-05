CREATE TYPE "space_resource_kind" AS ENUM('drive', 'mailbox', 'calendar', 'matrix_space');--> statement-breakpoint
CREATE TYPE "space_role" AS ENUM('viewer', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "token_audit_action" AS ENUM('created', 'revoked', 'renamed');--> statement-breakpoint
CREATE TYPE "token_owner_kind" AS ENUM('account', 'organization');--> statement-breakpoint
CREATE TYPE "token_scope" AS ENUM('space:read', 'space:write', 'members:write', 'feed:read', 'tokens:write');--> statement-breakpoint
CREATE TABLE "api_token_spaces" (
	"token_id" uuid,
	"space_id" uuid,
	CONSTRAINT "api_token_spaces_pkey" PRIMARY KEY("token_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"owner_kind" "token_owner_kind" NOT NULL,
	"owner_username" text,
	"name" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"scopes" "token_scope"[] NOT NULL,
	"role" "space_role",
	"all_spaces" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_owner" CHECK (("owner_kind" = 'account') = ("owner_username" is not null)),
	CONSTRAINT "api_tokens_role" CHECK (("owner_kind" = 'organization') = ("role" is not null))
);
--> statement-breakpoint
CREATE TABLE "oidc_revoked_sessions" (
	"sid" text PRIMARY KEY,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_token_policy" (
	"organization_id" text PRIMARY KEY,
	"allow_no_expiry" boolean DEFAULT false NOT NULL,
	"max_lifetime_days" integer,
	CONSTRAINT "organization_token_policy_lifetime" CHECK ("max_lifetime_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"consumer" text,
	"source" text,
	"id" text,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_pkey" PRIMARY KEY("consumer","source","id")
);
--> statement-breakpoint
CREATE TABLE "space_groups" (
	"space_id" uuid,
	"group_id" text,
	"role" "space_role" NOT NULL,
	CONSTRAINT "space_groups_pkey" PRIMARY KEY("space_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "space_members" (
	"space_id" uuid,
	"username" text,
	"email" text NOT NULL,
	"role" "space_role" NOT NULL,
	CONSTRAINT "space_members_pkey" PRIMARY KEY("space_id","username")
);
--> statement-breakpoint
CREATE TABLE "space_resources" (
	"space_id" uuid,
	"kind" "space_resource_kind",
	"organization_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"provisioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_resources_pkey" PRIMARY KEY("space_id","kind")
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"space_id" uuid PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token_id" uuid NOT NULL,
	"action" "token_audit_action" NOT NULL,
	"actor" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "ws_tickets" (
	"ticket_hash" text PRIMARY KEY,
	"username" text NOT NULL,
	"organization_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "api_token_spaces_space_id_index" ON "api_token_spaces" ("space_id");--> statement-breakpoint
CREATE INDEX "api_tokens_organization_id_owner_username_index" ON "api_tokens" ("organization_id","owner_username");--> statement-breakpoint
CREATE INDEX "oidc_revoked_sessions_expires_at_index" ON "oidc_revoked_sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX "space_groups_group_id_index" ON "space_groups" ("group_id");--> statement-breakpoint
CREATE INDEX "space_members_username_index" ON "space_members" ("username");--> statement-breakpoint
CREATE INDEX "spaces_organization_id_index" ON "spaces" ("organization_id");--> statement-breakpoint
CREATE INDEX "token_audit_token_id_index" ON "token_audit" ("token_id");--> statement-breakpoint
CREATE INDEX "ws_tickets_expires_at_index" ON "ws_tickets" ("expires_at");--> statement-breakpoint
ALTER TABLE "api_token_spaces" ADD CONSTRAINT "api_token_spaces_token_id_api_tokens_id_fkey" FOREIGN KEY ("token_id") REFERENCES "api_tokens"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "token_audit" ADD CONSTRAINT "token_audit_token_id_api_tokens_id_fkey" FOREIGN KEY ("token_id") REFERENCES "api_tokens"("id");