import { vi } from 'vitest'

import type {
  ApiToken,
  NewToken,
  TokenOwner,
  TokenPolicy,
  TokensService,
  TokenSpace
} from '@/application/tokens'

export function fakeTokens(
  initial: Partial<Record<TokenOwner, ApiToken[]>> = {},
  {
    policy = { allowNoExpiry: false, maxLifetimeDays: null },
    spaces = []
  }: { policy?: TokenPolicy; spaces?: TokenSpace[] } = {}
): TokensService {
  const tokens = {
    personal: [...(initial.personal ?? [])],
    organization: [...(initial.organization ?? [])]
  }
  return {
    list: vi.fn((owner: TokenOwner) => Promise.resolve([...tokens[owner]])),
    create: vi.fn(
      (owner: TokenOwner, { name, scopes, spaces, role }: NewToken) => {
        const id = `token-${String(tokens[owner].length + 1)}`
        const token = {
          id,
          name,
          scopes,
          spaces,
          role: role ?? null,
          expiresAt: '2026-11-06T08:00:00.000Z'
        }
        tokens[owner].push({
          ...token,
          lastUsedAt: null,
          createdAt: '2026-10-07T08:00:00.000Z'
        })
        return Promise.resolve({ ...token, token: `tws_${id}` })
      }
    ),
    rename: vi.fn(() => Promise.resolve()),
    revoke: vi.fn(() => Promise.resolve()),
    policy: vi.fn(() => Promise.resolve(policy)),
    organizationSpaces: vi.fn(() => Promise.resolve(spaces))
  }
}
