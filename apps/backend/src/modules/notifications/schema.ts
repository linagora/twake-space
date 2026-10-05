import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { timestamptz } from '../../infra/db.ts'

export const notificationType = pgEnum('notification_type', [
  'card_mention',
  'message_mention',
  'assignment',
  'invitation',
  'attended_event_change',
  'space_change'
])

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: text('organization_id').notNull(),
    recipient: text().notNull(),
    type: notificationType().notNull(),
    spaceId: uuid('space_id'),
    activityEventId: text('activity_event_id'),
    matrixEventId: text('matrix_event_id'),
    payload: jsonb().notNull(),
    readAt: timestamptz('read_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow()
  },
  table => [
    check(
      'notifications_one_source',
      sql`(${table.activityEventId} is null) <> (${table.matrixEventId} is null)`
    ),
    uniqueIndex('notifications_activity_event_idx')
      .on(table.recipient, table.type, table.activityEventId)
      .where(sql`${table.activityEventId} is not null`),
    uniqueIndex('notifications_matrix_event_idx')
      .on(table.recipient, table.type, table.matrixEventId)
      .where(sql`${table.matrixEventId} is not null`),
    index('notifications_recipient_idx').on(
      table.recipient,
      sql`(${table.readAt} is null)`,
      table.createdAt
    ),
    index().on(table.createdAt)
  ]
)

// A row is the user's choice; without one, every type is on except space_change.
export const notificationSettings = pgTable(
  'notification_settings',
  {
    email: text().notNull(),
    type: notificationType().notNull(),
    enabled: boolean().notNull()
  },
  table => [primaryKey({ columns: [table.email, table.type] })]
)
