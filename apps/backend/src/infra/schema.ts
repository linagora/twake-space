import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core'

const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

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
    username: text().notNull(),
    email: text().notNull(),
    role: spaceRole().notNull()
  },
  table => [
    primaryKey({ columns: [table.spaceId, table.username] }),
    index().on(table.username)
  ]
)

export const spaceGroups = pgTable(
  'space_groups',
  {
    spaceId: uuid('space_id').notNull(),
    groupId: text('group_id').notNull(),
    role: spaceRole().notNull()
  },
  table => [
    primaryKey({ columns: [table.spaceId, table.groupId] }),
    index().on(table.groupId)
  ]
)

export const spaceResourceKind = pgEnum('space_resource_kind', [
  'drive',
  'mailbox',
  'calendar',
  'matrix_space'
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
  table => [primaryKey({ columns: [table.spaceId, table.kind] })]
)

export const tokenOwnerKind = pgEnum('token_owner_kind', [
  'account',
  'organization'
])
export const tokenScope = pgEnum('token_scope', [
  'space:read',
  'space:write',
  'members:write',
  'feed:read',
  'tokens:write'
])

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: text('organization_id').notNull(),
    ownerKind: tokenOwnerKind('owner_kind').notNull(),
    ownerUsername: text('owner_username'),
    name: text().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    scopes: tokenScope().array().notNull(),
    role: spaceRole(),
    allSpaces: boolean('all_spaces').notNull().default(false),
    expiresAt: timestamptz('expires_at'),
    lastUsedAt: timestamptz('last_used_at'),
    revokedAt: timestamptz('revoked_at'),
    revokedReason: text('revoked_reason'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow()
  },
  table => [
    index().on(table.organizationId, table.ownerUsername),
    check(
      'api_tokens_owner',
      sql`(${table.ownerKind} = 'account') = (${table.ownerUsername} is not null)`
    ),
    check(
      'api_tokens_role',
      sql`(${table.ownerKind} = 'organization') = (${table.role} is not null)`
    )
  ]
)

export const apiTokenSpaces = pgTable(
  'api_token_spaces',
  {
    tokenId: uuid('token_id')
      .notNull()
      .references(() => apiTokens.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id').notNull()
  },
  table => [
    primaryKey({ columns: [table.tokenId, table.spaceId] }),
    index().on(table.spaceId)
  ]
)

export const organizationTokenPolicy = pgTable(
  'organization_token_policy',
  {
    organizationId: text('organization_id').primaryKey(),
    allowNoExpiry: boolean('allow_no_expiry').notNull().default(false),
    maxLifetimeDays: integer('max_lifetime_days')
  },
  table => [
    check(
      'organization_token_policy_lifetime',
      sql`${table.maxLifetimeDays} > 0`
    )
  ]
)

export const tokenAuditAction = pgEnum('token_audit_action', [
  'created',
  'revoked',
  'renamed'
])

export const tokenAudit = pgTable(
  'token_audit',
  {
    id: uuid().primaryKey().defaultRandom(),
    tokenId: uuid('token_id')
      .notNull()
      .references(() => apiTokens.id),
    action: tokenAuditAction().notNull(),
    actor: text().notNull(),
    at: timestamptz('at').notNull().defaultNow(),
    reason: text()
  },
  table => [index().on(table.tokenId)]
)

export const oidcRevokedSessions = pgTable(
  'oidc_revoked_sessions',
  {
    sid: text().primaryKey(),
    revokedAt: timestamptz('revoked_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull()
  },
  table => [index().on(table.expiresAt)]
)

export const wsTickets = pgTable(
  'ws_tickets',
  {
    ticketHash: text('ticket_hash').primaryKey(),
    username: text().notNull(),
    organizationId: text('organization_id').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at')
  },
  table => [index().on(table.expiresAt)]
)
