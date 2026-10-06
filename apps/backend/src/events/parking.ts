import { and, eq, lt, sql } from 'drizzle-orm'
import type { Logger } from 'pino'
import type { Db } from '../infra/db.ts'
import { headerString } from './envelope.ts'
import {
  deadLetterTopic,
  type DeadLetter,
  type IncomingMessage,
  type Outcome,
  type Park
} from './router.ts'
import { parkedEvents } from './schema.ts'

// Long enough for the platform topic to catch up after a restart.
const WAIT_SECONDS = 5 * 60
const RETRY_EVERY_MS = 5000
const BATCH = 100

export function parkIn(db: Db): Park {
  return async (topic, message, key, reason) => {
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries(message.headers ?? {})) {
      const text = headerString(value)
      if (text !== undefined) headers[name] = text
    }
    await db
      .insert(parkedEvents)
      .values({
        topic,
        ...key,
        key: message.key?.toString() ?? null,
        value: message.value?.toString() ?? '',
        headers,
        reason
      })
      .onConflictDoNothing()
  }
}

export async function retryParked(
  db: Db,
  handle: (topic: string, message: IncomingMessage) => Promise<Outcome>,
  deadLetter: DeadLetter,
  log: Logger
): Promise<void> {
  const rows = await db
    .select()
    .from(parkedEvents)
    .orderBy(parkedEvents.parkedAt)
    .limit(BATCH)
  for (const row of rows) {
    const message: IncomingMessage = {
      key: row.key === null ? null : Buffer.from(row.key),
      value: Buffer.from(row.value),
      offset: 'parked',
      headers: row.headers
    }
    const done = and(
      eq(parkedEvents.topic, row.topic),
      eq(parkedEvents.source, row.source),
      eq(parkedEvents.id, row.id)
    )
    let outcome: Outcome
    try {
      outcome = await handle(row.topic, message)
    } catch (error) {
      log.warn(
        { err: error, topic: row.topic, id: row.id },
        'parked event failed'
      )
      continue
    }
    if (outcome === 'parked') {
      const [expired] = await db
        .delete(parkedEvents)
        .where(
          and(
            done,
            lt(
              parkedEvents.parkedAt,
              sql`now() - make_interval(secs => ${WAIT_SECONDS})`
            )
          )
        )
        .returning({ reason: parkedEvents.reason })
      if (expired) {
        await deadLetter(deadLetterTopic(row.topic), message, expired.reason)
        log.warn(
          { topic: row.topic, id: row.id, reason: expired.reason },
          'parked event sent to the dead letter topic'
        )
      }
      continue
    }
    await db.delete(parkedEvents).where(done)
  }
}

// One replica retries at a time, so a parked event is handled once.
export function scheduleParkedRetries(
  db: Db,
  handle: (topic: string, message: IncomingMessage) => Promise<Outcome>,
  deadLetter: DeadLetter,
  log: Logger
): () => void {
  let timer: NodeJS.Timeout | undefined
  let stopped = false
  const pass = () =>
    db.transaction(async tx => {
      const [lock] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtext('parked_events')) as locked`
      )
      if (lock?.locked) await retryParked(db, handle, deadLetter, log)
    })
  const loop = () => {
    pass()
      .catch((error: unknown) => {
        log.error({ err: error }, 'retrying parked events failed')
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(loop, RETRY_EVERY_MS)
      })
  }
  loop()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
