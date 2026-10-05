import { boolean, bytea, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamptz } from '../../infra/db.ts'

export const organizations = pgTable('organizations', {
  organizationId: text('organization_id').primaryKey(),
  domain: text().notNull(),
  chatAvailable: boolean('chat_available').notNull().default(false),
  mailAvailable: boolean('mail_available').notNull().default(false),
  homeserverUrl: text('homeserver_url'),
  matrixServerName: text('matrix_server_name'),
  // AES-256-GCM ciphertexts; the hash identifies the organization of an app service transaction.
  asToken: bytea('as_token'),
  hsToken: bytea('hs_token'),
  hsTokenHash: text('hs_token_hash').unique(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow()
})
