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
    organizationId: text('organization_id'),
    // The recipient's LDAP entryUUID.
    userId: uuid('user_id').notNull(),
    type: notificationType().notNull(),
    spaceId: uuid('space_id'),
    activityEventId: uuid('activity_event_id'),
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
      .on(table.userId, table.type, table.activityEventId)
      .where(sql`${table.activityEventId} is not null`),
    uniqueIndex('notifications_matrix_event_idx')
      .on(table.userId, table.type, table.matrixEventId)
      .where(sql`${table.matrixEventId} is not null`),
    index('notifications_user_idx').on(
      table.userId,
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
    userId: uuid('user_id').notNull(),
    type: notificationType().notNull(),
    enabled: boolean().notNull()
  },
  table => [primaryKey({ columns: [table.userId, table.type] })]
)
