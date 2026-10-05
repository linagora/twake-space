CREATE TABLE "app_service_transactions" (
	"homeserver_id" uuid,
	"txn_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_service_transactions_pkey" PRIMARY KEY("homeserver_id","txn_id")
);
--> statement-breakpoint
CREATE INDEX "app_service_transactions_created_at_index" ON "app_service_transactions" ("created_at");--> statement-breakpoint
ALTER TABLE "app_service_transactions" ADD CONSTRAINT "app_service_transactions_homeserver_id_homeservers_id_fkey" FOREIGN KEY ("homeserver_id") REFERENCES "homeservers"("id") ON DELETE CASCADE;