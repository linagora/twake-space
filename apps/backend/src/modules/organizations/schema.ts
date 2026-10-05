import { boolean, bytea, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamptz } from '../../infra/db.ts'

// A single installation has one homeserver for every organization, so a
// transaction's organization comes from its room, never from the hs_token.
export const homeservers = pgTable('homeservers', {
  id: uuid().primaryKey().defaultRandom(),
  url: text().notNull(),
  serverName: text('server_name').notNull(),
  // AES-256-GCM ciphertexts
  asToken: bytea('as_token').notNull(),
  hsToken: bytea('hs_token').notNull(),
  hsTokenHash: text('hs_token_hash').notNull().unique(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow()
})

export const organizations = pgTable('organizations', {
  organizationId: text('organization_id').primaryKey(),
  domain: text().notNull(),
  chatAvailable: boolean('chat_available').notNull().default(false),
  mailAvailable: boolean('mail_available').notNull().default(false),
  homeserverId: uuid('homeserver_id').references(() => homeservers.id),
  updatedAt: timestamptz('updated_at').notNull().defaultNow()
})
