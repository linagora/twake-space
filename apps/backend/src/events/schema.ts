import { jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'
import { timestamptz } from '../infra/db.ts'

export const processedEvents = pgTable(
  'processed_events',
  {
    consumer: text().notNull(),
    source: text().notNull(),
    id: text().notNull(),
    processedAt: timestamptz('processed_at').notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.consumer, table.source, table.id] })]
)

// Events about a space or member the copy doesn't hold yet, set aside so the
// queue keeps flowing.
export const parkedEvents = pgTable(
  'parked_events',
  {
    source: text().notNull(),
    id: text().notNull(),
    exchange: text().notNull(),
    routingKey: text('routing_key').notNull(),
    messageId: text('message_id'),
    body: jsonb().notNull(),
    reason: text().notNull(),
    parkedAt: timestamptz('parked_at').notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.source, table.id] })]
)

// Kept after the object itself is removed, so a replayed event cannot bring it back.
export const lastChanges = pgTable('last_changes', {
  object: text().primaryKey(),
  at: timestamptz('at').notNull()
})
