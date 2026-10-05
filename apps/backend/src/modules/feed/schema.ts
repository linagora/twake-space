import { sql } from 'drizzle-orm'
import { index, jsonb, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { timestamptz } from '../../infra/db.ts'

export const feedCategory = pgEnum('feed_category', [
  'messages',
  'files',
  'activities',
  'events'
])

export const activityEvents = pgTable(
  'activity_events',
  {
    id: text().primaryKey(),
    // Null for a B2C user's event.
    organizationId: text('organization_id'),
    // Null for an object outside any space: used for personal notifications only.
    spaceId: uuid('space_id'),
    type: text().notNull(),
    category: feedCategory().notNull(),
    actor: text().notNull(),
    objectType: text('object_type').notNull(),
    objectId: text('object_id').notNull(),
    content: jsonb().notNull(),
    time: timestamptz('time').notNull(),
    matrixEventId: text('matrix_event_id'),
    createdAt: timestamptz('created_at').notNull().defaultNow()
  },
  table => [
    index('activity_events_unposted_idx')
      .on(table.spaceId, table.time)
      .where(
        sql`${table.matrixEventId} is null and ${table.spaceId} is not null`
      ),
    index().on(table.spaceId, table.objectType, table.objectId, table.time),
    index().on(table.createdAt)
  ]
)

export const feedMessages = pgTable(
  'feed_messages',
  {
    matrixEventId: text('matrix_event_id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    spaceId: uuid('space_id').notNull(),
    sender: text().notNull(),
    content: jsonb().notNull(),
    originServerTs: timestamptz('origin_server_ts').notNull(),
    editedContent: jsonb('edited_content'),
    editedAt: timestamptz('edited_at'),
    redactedAt: timestamptz('redacted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow()
  },
  table => [index().on(table.createdAt)]
)

export const feedReactions = pgTable(
  'feed_reactions',
  {
    matrixEventId: text('matrix_event_id').primaryKey(),
    targetEventId: text('target_event_id').notNull(),
    sender: text().notNull(),
    key: text().notNull(),
    redactedAt: timestamptz('redacted_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow()
  },
  table => [index().on(table.createdAt)]
)
