import type { HttpServer } from '../../infra/http.ts'
import type { RequireIdentity } from '../auth/index.ts'
import type { Streams } from './streams.ts'

// Under the idle timeout of common proxies, so they keep the stream open.
const HEARTBEAT_MS = 25_000

export function registerLiveRoutes(
  app: HttpServer,
  deps: { requireIdentity: RequireIdentity; streams: Streams }
) {
  const { streams } = deps

  // A server waits for its open connections before it stops.
  app.addHook('preClose', done => {
    streams.closeAll()
    done()
  })

  app.get('/stream', { preHandler: deps.requireIdentity }, (request, reply) => {
    const identity = request.identity
    if (!identity) throw new Error('requireIdentity let a request through')
    reply.hijack()
    const response = reply.raw
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no'
    })
    response.write(': open\n\n')

    const close = () => response.end()
    const remove = streams.add({ sessionId: identity.sessionId, close })
    const heartbeat = setInterval(
      () => response.write(': heartbeat\n\n'),
      HEARTBEAT_MS
    )
    const expiry = setTimeout(close, identity.expiresAt.getTime() - Date.now())
    response.on('close', () => {
      clearInterval(heartbeat)
      clearTimeout(expiry)
      remove()
    })
  })
}
