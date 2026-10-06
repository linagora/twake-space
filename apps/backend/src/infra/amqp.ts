import {
  DeadLetterError,
  RabbitMQClient,
  type RabbitMQMessageHandler
} from '@linagora/rabbitmq-client'
import type { Logger } from 'pino'
import type { Config } from '../config.ts'
import { ACTIVITY_EXCHANGE } from '../events/envelope.ts'
import type { DeadLetter, IncomingMessage, Outcome } from '../events/router.ts'

const QUEUE = 'twake-space'
const DEAD_LETTER_EXCHANGE = `${QUEUE}.dlx`
const DEAD_LETTER_QUEUE = `${QUEUE}.dlq`

// Only what a handler exists for: a binding without one would only ack and drop.
const BINDINGS = [
  { exchange: 'space', routingKey: 'twake.space.#' },
  { exchange: 'b2b', routingKey: 'b2b.group.updated' },
  { exchange: 'b2b', routingKey: 'b2b.member.role.changed' },
  { exchange: 'b2b', routingKey: 'b2b.member.disabled' },
  { exchange: 'b2b', routingKey: 'domain.user.deleted' },
  { exchange: 'b2b', routingKey: 'domain.organization.deleted' },
  { exchange: 'b2b', routingKey: 'chat.deprovision' },
  { exchange: 'b2b', routingKey: 'chat.deployment.completed' },
  { exchange: 'admin-panel', routingKey: 'dns.validated' },
  { exchange: ACTIVITY_EXCHANGE, routingKey: '#' }
] as const

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 60_000
const STUCK_MS = 5 * 60_000
// The broker's consumer_timeout (30 minutes by default) closes a channel that
// holds an unacked delivery for longer, which counts a redelivery.
const LONG_FAILING_MS = 25 * 60_000

type Handle = (message: IncomingMessage) => Promise<Outcome>

export type ConsumerStats = ReturnType<typeof consumerStats>

export function consumerStats() {
  const outcomes = new Map<Outcome | 'failed', number>()
  let handlingSince: number | undefined
  return {
    outcomes,
    started() {
      handlingSince = Date.now()
    },
    ended(outcome: Outcome | 'failed') {
      handlingSince = undefined
      outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1)
    },
    stuck: () =>
      handlingSince !== undefined && Date.now() - handlingSince > STUCK_MS
  }
}

// An idle consumer is alive: only a stuck handler or a lost connection is not.
export function consumerAlive(
  client: Pick<RabbitMQClient, 'isConnected'>,
  stats: ConsumerStats
): boolean {
  return client.isConnected() && !stats.stuck()
}

// With one message in flight at a time, a failure streak is that message's.
export function deliveryHandler(
  handle: Handle,
  stats: ConsumerStats,
  logger: Logger
): RabbitMQMessageHandler {
  let failingSince: number | undefined
  let warned = false
  return async (body, { exchange, routingKey, messageId }) => {
    stats.started()
    let outcome: Outcome
    try {
      outcome = await handle({
        exchange,
        routingKey,
        ...(messageId !== undefined && { messageId }),
        body
      })
    } catch (error) {
      stats.ended('failed')
      failingSince ??= Date.now()
      if (!warned && Date.now() - failingSince > LONG_FAILING_MS) {
        warned = true
        logger.error(
          { exchange, routingKey, messageId },
          'a message has failed for over 25 minutes; the broker may redeliver it'
        )
      }
      throw error
    }
    stats.ended(outcome)
    failingSince = undefined
    warned = false
    if (outcome === 'rejected') {
      throw new DeadLetterError(`rejected ${routingKey}`)
    }
  }
}

export function deadLetterQueue(
  client: Pick<RabbitMQClient, 'publish'>
): DeadLetter {
  return (message, reason) =>
    client.publish(
      '',
      DEAD_LETTER_QUEUE,
      message.body as Record<string, unknown>,
      {
        ...(message.messageId !== undefined && {
          messageId: message.messageId
        }),
        headers: {
          'x-twake-space-exchange': message.exchange,
          'x-twake-space-routing-key': message.routingKey,
          'x-twake-space-reason': reason
        }
      }
    )
}

export async function startConsumer(
  config: Config,
  logger: Logger,
  handle: Handle,
  stats: ConsumerStats
): Promise<RabbitMQClient> {
  const client = new RabbitMQClient({
    url: config.AMQP_URL,
    // One message at a time keeps the order the publishers sent.
    prefetch: 1,
    retryDelay: FIRST_RETRY_MS,
    // The client logs every message at info.
    logger: logger.child({ component: 'amqp' }, { level: 'warn' })
  })
  await client.init()
  const [primary, ...bindings] = BINDINGS
  await client.subscribe(
    primary.exchange,
    primary.routingKey,
    QUEUE,
    deliveryHandler(handle, stats, logger),
    {
      bindings: [...bindings],
      deadLetterExchange: DEAD_LETTER_EXCHANGE,
      // Other services own these; the apps and we declare `activity`.
      passiveExchanges: BINDINGS.map(b => b.exchange).filter(
        exchange => exchange !== ACTIVITY_EXCHANGE
      ),
      maxRetries: Infinity,
      maxRetryDelay: MAX_RETRY_MS,
      queueArguments: {
        'x-single-active-consumer': true,
        'x-delivery-limit': 5
      }
    }
  )
  return client
}
