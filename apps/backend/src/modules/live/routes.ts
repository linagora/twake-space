import type { HttpServer } from '../../infra/http.ts'
import type { Authorize } from '../auth/index.ts'
import type { Streams } from './streams.ts'

// Under the idle timeout of common proxies, so they keep the stream open.
const HEARTBEAT_MS = 25_000

export function registerLiveRoutes(
  app: HttpServer,
  deps: { authorize: Authorize; streams: Streams }
) {
  const { streams } = deps

  // A server waits for its open connections before it stops.
  app.addHook('preClose', done => {
    streams.closeAll()
    done()
  })

  app.get('/stream', { preHandler: deps.authorize() }, (request, reply) => {
    const identity = request.caller
    if (identity?.kind !== 'session') {
      throw new Error('authorize let a request through')
    }
    reply.hijack()
    const response = reply.raw
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no'
    })
    response.write(': open\n\n')

    const heartbeat = setInterval(
      () => response.write(': heartbeat\n\n'),
      HEARTBEAT_MS
    )
    // Stops the heartbeat before ending: 'close' fires later, and a write after
    // end() is an uncaught error.
    const close = () => {
      clearInterval(heartbeat)
      clearTimeout(expiry)
      response.end()
    }
    const expiry = setTimeout(close, identity.expiresAt.getTime() - Date.now())
    const remove = streams.add({
      sessionId: identity.sessionId,
      userId: identity.userId,
      send: (event, data) => {
        if (response.writableEnded) return
        response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      },
      close
    })
    response.on('close', () => {
      clearInterval(heartbeat)
      clearTimeout(expiry)
      remove()
    })
  })
}
