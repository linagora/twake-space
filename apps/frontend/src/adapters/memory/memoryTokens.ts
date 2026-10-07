import type { Refusal } from '@/application/spaces'
import type { ApiToken, TokenOwner, TokensService } from '@/application/tokens'

const DAY_MS = 24 * 60 * 60 * 1000

const refuse = (status: number, code: string, reason: string) =>
  Promise.reject(
    Object.assign(new Error(code), { status, code, reason } satisfies Refusal)
  )

export function memoryTokens(
  seed: Record<TokenOwner, ApiToken[]>,
  { organizationAdmin }: { organizationAdmin: boolean }
): TokensService {
  const tokens = {
    personal: [...seed.personal],
    organization: [...seed.organization]
  }
  let next = 1
  const guard = (owner: TokenOwner) =>
    owner === 'organization' && !organizationAdmin
      ? refuse(403, 'forbidden', 'not an admin of the organization')
      : null
  const find = (owner: TokenOwner, id: string) =>
    tokens[owner].find(token => token.id === id)

  return {
    list: owner => guard(owner) ?? Promise.resolve([...tokens[owner]]),
    create: (owner, { name, scopes, spaces, role, expiresInDays }) => {
      const refused = guard(owner)
      if (refused) return refused
      const id = `token-${String(next++)}`
      const now = Date.now()
      tokens[owner].push({
        id,
        name,
        scopes,
        spaces,
        role: role ?? null,
        expiresAt: new Date(now + expiresInDays * DAY_MS).toISOString(),
        lastUsedAt: null,
        createdAt: new Date(now).toISOString()
      })
      return Promise.resolve({ id, name, token: `tws_mock${id}` })
    },
    rename: (owner, id, name) => {
      const refused = guard(owner)
      if (refused) return refused
      const token = find(owner, id)
      if (!token) return refuse(404, 'not_found', 'token not found')
      token.name = name
      return Promise.resolve()
    },
    revoke: (owner, id) => {
      const refused = guard(owner)
      if (refused) return refused
      if (!find(owner, id)) return refuse(404, 'not_found', 'token not found')
      tokens[owner] = tokens[owner].filter(token => token.id !== id)
      return Promise.resolve()
    }
  }
}
