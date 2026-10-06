import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { matrixClient, MatrixError } from './matrix.ts'

describe('matrixClient', () => {
  it('sends and joins as the app service', async () => {
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
    const matrix = matrixClient()
    const homeserver = { url, asToken: 'as-secret' }

    try {
      const eventId = await matrix.send(
        homeserver,
        '!room:example.com',
        'com.twake.feed.files',
        'txn-1',
        { body: 'hi' }
      )
      const broken = matrix.send(
        homeserver,
        '!broken:example.com',
        'com.twake.feed.files',
        'txn-2',
        {}
      )
      await expect(broken).rejects.toThrow('500')
      await expect(broken).rejects.toMatchObject({
        status: 500,
        errcode: 'M_UNKNOWN'
      })
      await expect(broken).rejects.toBeInstanceOf(MatrixError)

      await matrix.join(homeserver, '!room:example.com')

      expect(eventId).toBe('$abc')
      expect(requests[0]).toEqual({
        method: 'PUT',
        url: '/_matrix/client/v3/rooms/!room%3Aexample.com/send/com.twake.feed.files/txn-1',
        auth: 'Bearer as-secret',
        body: '{"body":"hi"}'
      })
      expect(requests.find(r => r.method === 'POST')).toMatchObject({
        method: 'POST',
        url: '/_matrix/client/v3/rooms/!room%3Aexample.com/join',
        auth: 'Bearer as-secret'
      })
    } finally {
      server.close()
    }
  })
})
