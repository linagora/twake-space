import type { Logger } from 'pino'
import { z } from 'zod'
import { postgresRefusal, type Tx } from '../infra/db.ts'
import type { Deduplicator, EventKey } from './dedupe.ts'
import {
  PLATFORM_TOPIC,
  parseCloudEvent,
  parsePlatformEvent,
  type CloudEvent,
  type ParseResult,
  type PlatformEvent
} from './envelope.ts'

export type Handler<E> = (event: E, tx: Tx, log: Logger) => Promise<void>

// Thrown by a handler for an event it can never process, so the offset moves on.
export class MalformedEventError extends Error {}

// Thrown by a handler for a well-formed event that contradicts the copy; kept on a
// dead letter topic for someone to look at.
export class RejectedEventError extends Error {}

// Thrown for an event about a space or member the copy doesn't hold yet: the
// platform event that brings it may only be late.
export class NotYetKnownError extends Error {}

export const deadLetterTopic = (topic: string) => `${topic}.dlq.twake-space`

export type Park = (
  topic: string,
  message: IncomingMessage,
  key: EventKey,
  reason: string
) => Promise<void>

export type DeadLetter = (
  topic: string,
  message: IncomingMessage,
  reason: string
) => Promise<void>

export function parseOrDrop<T extends z.ZodType>(
  schema: T,
  value: unknown,
  label: string
): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new MalformedEventError(`${label}: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

interface Lookup<H> {
  get(key: string): H | undefined
}

export interface Routes {
  activity: Lookup<Handler<CloudEvent>>
  platform: Lookup<Handler<PlatformEvent>>
}

export interface IncomingMessage {
  key?: Buffer | null
  value: Buffer | null
  offset: string
  headers?: Record<string, unknown>
}

export type Outcome =
  'processed' | 'duplicate' | 'unrouted' | 'malformed' | 'rejected' | 'parked'

export function createMessageHandler(deps: {
  routes: Routes
  dedupe: Deduplicator
  deadLetter: DeadLetter
  park: Park
  logger: Logger
}) {
  const { routes, dedupe, deadLetter, park, logger } = deps

  async function dispatch<E>(
    topic: string,
    message: IncomingMessage,
    parsed: ParseResult<E>,
    route: (event: E) => {
      key: string
      handler: Handler<E> | undefined
      dedupeKey: EventKey
    }
  ): Promise<Outcome> {
    const context = { topic, offset: message.offset }
    if (!parsed.ok) {
      logger.error(
        { ...context, error: parsed.error },
        'dropping malformed event'
      )
      return 'malformed'
    }
    const { key, handler, dedupeKey } = route(parsed.event)
    if (!handler) {
      logger.debug({ ...context, key }, 'no handler for event')
      return 'unrouted'
    }
    let processed: boolean
    try {
      processed = await dedupe.once(dedupeKey, tx =>
        handler(parsed.event, tx, logger.child({ ...context, key }))
      )
    } catch (error) {
      if (error instanceof NotYetKnownError) {
        await park(topic, message, dedupeKey, error.message)
        logger.info(
          { ...context, key, ...dedupeKey, reason: error.message },
          'event parked'
        )
        return 'parked'
      }
      const reason =
        error instanceof RejectedEventError
          ? error.message
          : postgresRefusal(error)
      if (reason) {
        await deadLetter(deadLetterTopic(topic), message, reason)
        logger.warn(
          { ...context, key, ...dedupeKey, reason },
          'event sent to the dead letter topic'
        )
        return 'rejected'
      }
      if (!(error instanceof MalformedEventError)) throw error
      logger.error(
        { ...context, key, ...dedupeKey, error: error.message },
        'dropping malformed event'
      )
      return 'malformed'
    }
    logger.info(
      { ...context, key, ...dedupeKey, duplicate: !processed },
      'event handled'
    )
    return processed ? 'processed' : 'duplicate'
  }

  return (topic: string, message: IncomingMessage): Promise<Outcome> =>
    topic === PLATFORM_TOPIC
      ? dispatch(
          topic,
          message,
          parsePlatformEvent(message.value, message.headers),
          event => ({
            key: event.routingKey,
            handler: routes.platform.get(event.routingKey),
            dedupeKey: { source: 'amqp', id: event.messageId }
          })
        )
      : dispatch(topic, message, parseCloudEvent(message.value), event => ({
          key: event.type,
          handler: routes.activity.get(event.type),
          dedupeKey: { source: event.source, id: event.id }
        }))
}
