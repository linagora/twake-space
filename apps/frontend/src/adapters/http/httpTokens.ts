import type { KyInstance } from 'ky'

import type {
  ApiToken,
  CreatedToken,
  TokenOwner,
  TokenPolicy,
  TokensService,
  TokenSpace
} from '@/application/tokens'

const PREFIX: Record<TokenOwner, string> = {
  personal: 'tokens',
  organization: 'organization/tokens'
}

export function httpTokens(api: KyInstance): TokensService {
  const token = (owner: TokenOwner, id: string) =>
    `${PREFIX[owner]}/${encodeURIComponent(id)}`
  const send = async (request: Promise<unknown>) => {
    await request
  }

  return {
    list: async owner =>
      (await api.get(PREFIX[owner]).json<{ tokens: ApiToken[] }>()).tokens,
    create: (owner, { expiresInDays, ...rest }) =>
      api
        .post(PREFIX[owner], {
          json: {
            ...rest,
            ...(expiresInDays === null
              ? { expiresAt: null }
              : { expiresInDays })
          }
        })
        .json<CreatedToken>(),
    rename: (owner, id, name) =>
      send(api.patch(token(owner, id), { json: { name } })),
    revoke: (owner, id) => send(api.delete(token(owner, id))),
    policy: () => api.get('organization/token-policy').json<TokenPolicy>(),
    organizationSpaces: async () =>
      (
        await api
          .get('organization/token-spaces')
          .json<{ spaces: TokenSpace[] }>()
      ).spaces
  }
}
