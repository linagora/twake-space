const SYNAPSE_TIMEOUT_MS = 10_000

export interface Homeserver {
  url: string
  asToken: string
}

export interface Matrix {
  send(
    homeserver: Homeserver,
    roomId: string,
    type: string,
    txnId: string,
    content: object
  ): Promise<string>
  // Accepts the bot's invite; a no-op once it is a member.
  join(homeserver: Homeserver, roomId: string): Promise<void>
}

async function call(
  homeserver: Homeserver,
  method: 'PUT' | 'POST',
  path: string[],
  body: object
): Promise<unknown> {
  const response = await fetch(
    `${homeserver.url}/_matrix/client/v3/${path.map(encodeURIComponent).join('/')}`,
    {
      method,
      headers: {
        authorization: `Bearer ${homeserver.asToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SYNAPSE_TIMEOUT_MS)
    }
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      errcode?: unknown
    }
    throw new MatrixError(
      response.status,
      typeof body.errcode === 'string' ? body.errcode : undefined
    )
  }
  return response.json()
}

export class MatrixError extends Error {
  readonly status: number
  readonly errcode: string | undefined
  constructor(status: number, errcode: string | undefined) {
    super(`Synapse answered ${String(status)} ${errcode ?? ''}`.trim())
    this.status = status
    this.errcode = errcode
  }
}

export function matrixClient(): Matrix {
  return {
    async send(homeserver, roomId, type, txnId, content) {
      const { event_id } = (await call(
        homeserver,
        'PUT',
        ['rooms', roomId, 'send', type, txnId],
        content
      )) as { event_id: string }
      return event_id
    },
    async join(homeserver, roomId) {
      await call(homeserver, 'POST', ['rooms', roomId, 'join'], {})
    }
  }
}
