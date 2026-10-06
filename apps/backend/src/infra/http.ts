import Fastify, { LogController } from 'fastify'
import type { Logger } from 'pino'

export function createServer(deps: {
  logger: Logger
  isReady: () => Promise<boolean>
  isAlive?: () => boolean
}) {
  const app = Fastify({
    loggerInstance: deps.logger,
    logController: new LogController({
      disableRequestLogging: request => request.url.startsWith('/health/')
    })
  })

  app.get('/health/live', (_request, reply) => {
    const alive = deps.isAlive?.() ?? true
    return reply
      .code(alive ? 200 : 503)
      .send({ status: alive ? 'ok' : 'unavailable' })
  })

  app.get('/health/ready', async (_request, reply) => {
    const ready = await deps.isReady().catch(() => false)
    return reply
      .code(ready ? 200 : 503)
      .send({ status: ready ? 'ok' : 'unavailable' })
  })

  return app
}

export type HttpServer = ReturnType<typeof createServer>
