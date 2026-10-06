import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid
} from 'drizzle-orm/pg-core'
import { timestamptz } from '../../infra/db.ts'

export const spaceRole = pgEnum('space_role', ['viewer', 'editor', 'admin'])

export const spaces = pgTable(
  'spaces',
  {
    spaceId: uuid('space_id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    name: text().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow()
  },
  table => [index().on(table.organizationId)]
)

// The tables below have no foreign key to spaces: they are fed by events that can be
// consumed before the space event.

export const spaceMembers = pgTable(
  'space_members',
  {
    spaceId: uuid('space_id').notNull(),
    // The LDAP entryUUID: a username or an email can change.
    userId: uuid('user_id').notNull(),
    username: text().notNull(),
    email: text().notNull(),
    role: spaceRole().notNull()
  },
  table => [
    primaryKey({ columns: [table.spaceId, table.userId] }),
    index().on(table.userId)
  ]
)

export const spaceGroups = pgTable(
  'space_groups',
  {
    spaceId: uuid('space_id').notNull(),
    groupId: uuid('group_id').notNull(),
    name: text().notNull(),
    role: spaceRole().notNull()
  },
  table => [
    primaryKey({ columns: [table.spaceId, table.groupId] }),
    index().on(table.groupId)
  ]
)

// The newest name of a group, kept even while no space links it, so a link older
// than a rename takes the new name.
export const groupNames = pgTable('group_names', {
  groupId: uuid('group_id').primaryKey(),
  name: text().notNull(),
  renamedAt: timestamptz('renamed_at').notNull()
})

export const organizationRole = pgEnum('organization_role', [
  'owner',
  'admin',
  'moderator',
  'member'
])

export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: text('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    email: text().notNull(),
    role: organizationRole().notNull()
  },
  table => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index().on(table.userId)
  ]
)

export const spaceResourceKind = pgEnum('space_resource_kind', [
  'drive',
  'mailbox',
  'calendar',
  'matrix_space',
  'tasks'
])

export const spaceResources = pgTable(
  'space_resources',
  {
    spaceId: uuid('space_id').notNull(),
    kind: spaceResourceKind().notNull(),
    organizationId: text('organization_id').notNull(),
    resourceId: text('resource_id').notNull(),
    provisionedAt: timestamptz('provisioned_at').notNull().defaultNow()
  },
  table => [
    primaryKey({ columns: [table.spaceId, table.kind] }),
    index().on(table.kind, table.resourceId)
  ]
)
