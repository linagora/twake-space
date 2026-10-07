import type { KyInstance } from 'ky'

import type {
  ApiToken,
  CreatedToken,
  TokenOwner,
  TokensService
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
    create: (owner, json) =>
      api.post(PREFIX[owner], { json }).json<CreatedToken>(),
    rename: (owner, id, name) =>
      send(api.patch(token(owner, id), { json: { name } })),
    revoke: (owner, id) => send(api.delete(token(owner, id)))
  }
}
