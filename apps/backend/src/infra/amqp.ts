import {
  DeadLetterError,
  RabbitMQClient,
  type RabbitMQMessageHandler,
  type SubscribeOptions
} from '@linagora/rabbitmq-client'
import type { Logger } from 'pino'
import type { Config } from '../config.ts'
import { ACTIVITY_EXCHANGE } from '../events/envelope.ts'
import type { DeadLetter, IncomingMessage, Outcome } from '../events/router.ts'
import type { AmqpTopology } from '../events/topology.ts'

// Only what a handler exists for: a binding without one would only ack and drop.
export function subscription(topology: AmqpTopology) {
  const platform = Object.values(topology.events)
  const [primary, ...rest] = platform
  if (!primary) throw new Error('no platform event to bind')
  const options = {
    bindings: [
      ...rest,
      { exchange: topology.activityExchange, routingKey: '#' }
    ],
    deadLetterExchange: topology.deadLetterExchange,
    // Other services own these; the apps and we declare the activity one.
    passiveExchanges: [...new Set(platform.map(b => b.exchange))].filter(
      exchange => exchange !== topology.activityExchange
    ),
    maxRetries: Infinity,
    maxRetryDelay: MAX_RETRY_MS,
    queueArguments: {
      'x-single-active-consumer': true,
      // Failures retry in the process, so a redelivery means a crash or a
      // consumer_timeout: the default 20 rides out about 10 hours of outage.
      'x-delivery-limit': topology.deliveryLimit
    }
  } satisfies SubscribeOptions
  return { ...primary, queue: topology.queue, options }
}

// The router, its handlers and the parked rows know events by their default
// names, whatever a deployment calls the exchanges and keys.
export function canonical(
  topology: AmqpTopology,
  exchange: string,
  routingKey: string
): { exchange: string; routingKey: string } {
  if (exchange === topology.activityExchange) {
    return { exchange: ACTIVITY_EXCHANGE, routingKey }
  }
  const match = Object.entries(topology.events).find(
    ([, binding]) =>
      binding.exchange === exchange && binding.routingKey === routingKey
  )
  return { exchange, routingKey: match ? match[0] : routingKey }
}

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 60_000
const STUCK_MS = 5 * 60_000
// The client reconnects on its own; a broker restart should not restart pods.
const DISCONNECTED_MS = 60_000
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
): () => boolean {
  let disconnectedSince: number | undefined
  return () => {
    if (client.isConnected()) disconnectedSince = undefined
    else disconnectedSince ??= Date.now()
    const lost =
      disconnectedSince !== undefined &&
      Date.now() - disconnectedSince > DISCONNECTED_MS
    return !lost && !stats.stuck()
  }
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
  client: Pick<RabbitMQClient, 'publish'>,
  queue: string
): DeadLetter {
  return (message, reason) =>
    client.publish(
      '',
      `${queue}.dlq`,
      message.body as Record<string, unknown>,
      {
        ...(message.messageId !== undefined && {
          messageId: message.messageId
        }),
        // An unroutable publish then fails, which keeps the parked row.
        mandatory: true,
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
  const { exchange, routingKey, queue, options } = subscription(config.amqp)
  await client.subscribe(
    exchange,
    routingKey,
    queue,
    deliveryHandler(
      message =>
        handle({
          ...message,
          ...canonical(config.amqp, message.exchange, message.routingKey)
        }),
      stats,
      logger
    ),
    options
  )
  return client
}
