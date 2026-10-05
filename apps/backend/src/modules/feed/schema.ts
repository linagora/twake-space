import { sql } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid
} from 'drizzle-orm/pg-core'
import { timestamptz } from '../../infra/db.ts'

// A user's id is null when only their email was sent and they are in no space.
export type Actor =
  | { type: 'user'; id: string | null; email: string | null }
  | { type: 'token'; id: string; name: string }

export const feedCategory = pgEnum('feed_category', [
  'messages',
  'files',
  'activities',
  'events'
])

export const activityEvents = pgTable(
  'activity_events',
  {
    // Also the Matrix transaction id of the card: CloudEvent ids are only unique per source.
    id: uuid().primaryKey().defaultRandom(),
    source: text().notNull(),
    eventId: text('event_id').notNull(),
    // Null for a B2C user's event.
    organizationId: text('organization_id'),
    // Null for an object outside any space: used for personal notifications only.
    spaceId: uuid('space_id'),
    type: text().notNull(),
    category: feedCategory().notNull(),
    // Null for an event no one in particular made.
    actor: jsonb().$type<Actor>(),
    objectType: text('object_type').notNull(),
    objectId: text('object_id').notNull(),
    content: jsonb().notNull(),
    time: timestamptz('time').notNull(),
    matrixEventId: text('matrix_event_id'),
    createdAt: timestamptz('created_at').notNull().defaultNow()
  },
  table => [
    unique().on(table.source, table.eventId),
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
