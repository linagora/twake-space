import { pino } from 'pino'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type HttpServer } from '../../infra/http.ts'
import { aTokenCaller, anIdentity, fakeAuth } from '../auth/testing.ts'
import type { Identity } from '../auth/index.ts'
import { registerLiveRoutes } from './routes.ts'
import { createStreams } from './streams.ts'

let app: HttpServer

async function setUp(identity: Identity = anIdentity()) {
  app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true)
  })
  const authorize = fakeAuth(
    app,
    token => (token === 'good' ? identity : null),
    token => (token === 'tws_bot' ? aTokenCaller() : null)
  )
  const streams = createStreams()
  registerLiveRoutes(app, { authorize, streams })
  const address = await app.listen({ host: '127.0.0.1', port: 0 })
  return { streams, url: `${address}/stream` }
}

afterEach(() => app.close())

async function open(url: string) {
  const response = await fetch(url, {
    headers: { authorization: 'Bearer good' }
  })
  if (!response.body) throw new Error('no body')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  return { response, reader }
}

describe('GET /stream', () => {
  it('asks for a bearer token', async () => {
    const { url } = await setUp()

    const response = await fetch(url)

    expect(response.status).toBe(401)
  })

  it('refuses API tokens', async () => {
    const { url } = await setUp()

    const response = await fetch(url, {
      headers: { authorization: 'Bearer tws_bot' }
    })

    expect(response.status).toBe(403)
  })

  it('opens a server-sent event stream', async () => {
    const { url } = await setUp()

    const { response, reader } = await open(url)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect((await reader.read()).value).toBe(': open\n\n')
    await reader.cancel()
  })

  it('closes when the session is revoked', async () => {
    const { url, streams } = await setUp()
    const { reader } = await open(url)
    await reader.read()

    streams.closeSession('session-1')

    expect((await reader.read()).done).toBe(true)
  })

  it('keeps the streams of other sessions open', async () => {
    const { url, streams } = await setUp()
    const { reader } = await open(url)
    await reader.read()

    streams.closeSession('session-2')

    const next = await Promise.race([
      reader.read(),
      new Promise(resolve =>
        setTimeout(() => {
          resolve('still open')
        }, 100)
      )
    ])
    expect(next).toBe('still open')
    await reader.cancel()
  })

  it('closes when the token it was opened with expires', async () => {
    const { url } = await setUp(
      anIdentity({ expiresAt: new Date(Date.now() + 200) })
    )
    const { reader } = await open(url)
    await reader.read()

    expect((await reader.read()).done).toBe(true)
  })

  it('closes open streams when the server stops', async () => {
    const { url } = await setUp()
    const { reader } = await open(url)
    await reader.read()

    await app.close()

    expect((await reader.read()).done).toBe(true)
  })
})
