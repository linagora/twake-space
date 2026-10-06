import { pino } from 'pino'
import { expect, it } from 'vitest'
import { createServer } from './http.ts'

it('answers 503 on liveness once the process is no longer alive', async () => {
  let alive = true
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(true),
    isAlive: () => alive
  })
  const live = () => app.inject({ method: 'GET', url: '/health/live' })

  expect((await live()).statusCode).toBe(200)
  alive = false
  expect((await live()).statusCode).toBe(503)
})
