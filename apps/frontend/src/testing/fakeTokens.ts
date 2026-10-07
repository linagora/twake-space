import { vi } from 'vitest'

import type {
  ApiToken,
  NewToken,
  TokenOwner,
  TokensService
} from '@/application/tokens'

export function fakeTokens(
  initial: Partial<Record<TokenOwner, ApiToken[]>> = {}
): TokensService {
  const tokens = {
    personal: [...(initial.personal ?? [])],
    organization: [...(initial.organization ?? [])]
  }
  return {
    list: vi.fn((owner: TokenOwner) => Promise.resolve([...tokens[owner]])),
    create: vi.fn((owner: TokenOwner, { name, scopes, spaces }: NewToken) => {
      const id = `token-${String(tokens[owner].length + 1)}`
      tokens[owner].push({
        id,
        name,
        scopes,
        spaces,
        role: null,
        expiresAt: null,
        lastUsedAt: null,
        createdAt: '2026-10-07T08:00:00.000Z'
      })
      return Promise.resolve({ id, name, token: `tws_${id}` })
    }),
    rename: vi.fn(() => Promise.resolve()),
    revoke: vi.fn(() => Promise.resolve())
  }
}
