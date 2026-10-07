import type { Refusal } from '@/application/spaces'
import type {
  ApiToken,
  TokenOwner,
  TokenPolicy,
  TokensService,
  TokenSpace
} from '@/application/tokens'

const DAY_MS = 24 * 60 * 60 * 1000

const refuse = (status: number, code: string, reason?: string) =>
  Promise.reject(
    Object.assign(new Error(code), {
      status,
      code,
      ...(reason && { reason })
    } satisfies Refusal)
  )

export function memoryTokens(
  seed: Record<TokenOwner, ApiToken[]>,
  {
    organizationAdmin,
    policy,
    spaces
  }: { organizationAdmin: boolean; policy: TokenPolicy; spaces: TokenSpace[] }
): TokensService {
  const tokens = {
    personal: [...seed.personal],
    organization: [...seed.organization]
  }
  let next = 1
  const forbidden = (owner: TokenOwner) =>
    owner === 'organization' && !organizationAdmin
  const guard = (owner: TokenOwner) =>
    forbidden(owner)
      ? refuse(403, 'forbidden', 'not an admin of the organization')
      : null
  // Like the backend, a token the caller may not manage is not found.
  const find = (owner: TokenOwner, id: string) =>
    forbidden(owner) ? undefined : tokens[owner].find(token => token.id === id)

  return {
    list: owner => guard(owner) ?? Promise.resolve([...tokens[owner]]),
    create: (owner, { name, scopes, spaces, role, expiresInDays }) => {
      const refused = guard(owner)
      if (refused) return refused
      if (
        expiresInDays === null
          ? !policy.allowNoExpiry
          : policy.maxLifetimeDays !== null &&
            expiresInDays > policy.maxLifetimeDays
      ) {
        return refuse(
          400,
          'invalid_request',
          'the organization policy refuses this expiry'
        )
      }
      const id = `token-${String(next++)}`
      const now = Date.now()
      const token = {
        id,
        name,
        scopes,
        spaces,
        role: role ?? null,
        expiresAt:
          expiresInDays === null
            ? null
            : new Date(now + expiresInDays * DAY_MS).toISOString()
      }
      tokens[owner].push({
        ...token,
        lastUsedAt: null,
        createdAt: new Date(now).toISOString()
      })
      return Promise.resolve({ ...token, token: `tws_mock${id}` })
    },
    rename: (owner, id, name) => {
      const token = find(owner, id)
      if (!token) return refuse(404, 'not_found')
      token.name = name
      return Promise.resolve()
    },
    revoke: (owner, id) => {
      if (!find(owner, id)) return refuse(404, 'not_found')
      tokens[owner] = tokens[owner].filter(token => token.id !== id)
      return Promise.resolve()
    },
    policy: () => Promise.resolve(policy),
    organizationSpaces: () =>
      organizationAdmin
        ? Promise.resolve([...spaces])
        : refuse(403, 'forbidden', 'not an admin of the organization')
  }
}
