import type { SpaceRole } from '@/application/spaces'

export const TOKEN_SCOPES = [
  'space:read',
  'space:write',
  'members:write',
  'feed:read',
  'tokens:write'
] as const

export type TokenScope = (typeof TOKEN_SCOPES)[number]

/** Personal tokens act for the caller; organization tokens need an org admin. */
export type TokenOwner = 'personal' | 'organization'

export const TOKEN_LIFETIMES = [7, 30, 90, 365] as const

export type TokenLifetime = (typeof TOKEN_LIFETIMES)[number]

export interface ApiToken {
  id: string
  name: string
  scopes: TokenScope[]
  spaces: 'all' | string[]
  /** The role an organization token holds in its spaces; null otherwise. */
  role: SpaceRole | null
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface NewToken {
  name: string
  scopes: TokenScope[]
  spaces: 'all' | string[]
  /** Required for an organization token, refused for a personal one. */
  role?: SpaceRole
  expiresInDays: TokenLifetime
}

/** The secret is only ever shown in the answer to its creation. */
export interface CreatedToken {
  id: string
  name: string
  token: string
}

export interface TokensService {
  list: (owner: TokenOwner) => Promise<ApiToken[]>
  create: (owner: TokenOwner, token: NewToken) => Promise<CreatedToken>
  rename: (owner: TokenOwner, id: string, name: string) => Promise<void>
  revoke: (owner: TokenOwner, id: string) => Promise<void>
}
