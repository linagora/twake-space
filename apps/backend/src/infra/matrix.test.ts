import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { matrixSender } from './matrix.ts'

describe('matrixSender', () => {
  it('sends as the app service and returns the event id', async () => {
    const requests: {
      method: string | undefined
      url: string | undefined
      auth: string | undefined
      body: string
    }[] = []
    const server = createServer((request: IncomingMessage, response) => {
      let body = ''
      request.on('data', (chunk: Buffer) => (body += chunk.toString()))
      request.on('end', () => {
        requests.push({
          method: request.method,
          url: request.url,
          auth: request.headers.authorization,
          body
        })
        const broken = request.url?.includes('broken') === true
        response.writeHead(broken ? 500 : 200, {
          'content-type': 'application/json'
        })
        response.end(broken ? '{"errcode":"M_UNKNOWN"}' : '{"event_id":"$abc"}')
      })
    })
    await new Promise<void>(resolve => server.listen(0, resolve))
    const url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
    const send = matrixSender()

    try {
      const eventId = await send(
        { url, asToken: 'as-secret' },
        '!room:example.com',
        'com.twake.feed.files',
        'txn-1',
        { body: 'hi' }
      )
      const broken = send(
        { url, asToken: 'as-secret' },
        '!broken:example.com',
        'com.twake.feed.files',
        'txn-2',
        {}
      )

      expect(eventId).toBe('$abc')
      await expect(broken).rejects.toThrow('500')
      expect(requests[0]).toEqual({
        method: 'PUT',
        url: '/_matrix/client/v3/rooms/!room%3Aexample.com/send/com.twake.feed.files/txn-1',
        auth: 'Bearer as-secret',
        body: '{"body":"hi"}'
      })
    } finally {
      server.close()
    }
  })
})
