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

// Events about a space or member the copy doesn't hold yet, set aside so their
// partition keeps flowing.
export const parkedEvents = pgTable(
  'parked_events',
  {
    topic: text().notNull(),
    source: text().notNull(),
    id: text().notNull(),
    key: text(),
    value: text().notNull(),
    headers: jsonb().$type<Record<string, string>>().notNull(),
    reason: text().notNull(),
    parkedAt: timestamptz('parked_at').notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.topic, table.source, table.id] })]
)

// Kept after the object itself is removed, so a replayed event cannot bring it back.
export const lastChanges = pgTable('last_changes', {
  object: text().primaryKey(),
  at: timestamptz('at').notNull()
})
