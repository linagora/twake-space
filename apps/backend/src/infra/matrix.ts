const SYNAPSE_TIMEOUT_MS = 10_000

export interface Homeserver {
  url: string
  asToken: string
}

export type SendEvent = (
  homeserver: Homeserver,
  roomId: string,
  type: string,
  txnId: string,
  content: object
) => Promise<string>

export function matrixSender(): SendEvent {
  return async (homeserver, roomId, type, txnId, content) => {
    const path = [roomId, 'send', type, txnId].map(encodeURIComponent)
    const response = await fetch(
      `${homeserver.url}/_matrix/client/v3/rooms/${path.join('/')}`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${homeserver.asToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(content),
        signal: AbortSignal.timeout(SYNAPSE_TIMEOUT_MS)
      }
    )
    if (!response.ok) {
      throw new Error(`Synapse answered ${String(response.status)}`)
    }
    const { event_id } = (await response.json()) as { event_id: string }
    return event_id
  }
}
