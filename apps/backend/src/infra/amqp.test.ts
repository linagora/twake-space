import type { RabbitMQMessageProperties } from '@linagora/rabbitmq-client'
import { pino } from 'pino'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, Outcome } from '../events/router.ts'
import { amqpTopology } from '../events/topology.ts'
import {
  canonical,
  consumerAlive,
  consumerStats,
  deadLetterQueue,
  deliveryHandler,
  subscription
} from './amqp.ts'

const properties = (
  overrides: Partial<RabbitMQMessageProperties> = {}
): RabbitMQMessageProperties => ({
  exchange: 'b2b',
  routingKey: 'b2b.group.updated',
  messageId: 'm-1',
  headers: {},
  ...overrides
})

function setup(handle: (message: IncomingMessage) => Promise<Outcome>) {
  const lines: { level: number; msg: string }[] = []
  const logger = pino(
    { level: 'warn' },
    {
      write: (line: string) => {
        lines.push(JSON.parse(line) as { level: number; msg: string })
      }
    }
  )
  const stats = consumerStats()
  const deliver = deliveryHandler(vi.fn(handle), stats, logger)
  return { deliver, stats, lines }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('deliveryHandler', () => {
  it('hands the delivery to the router and counts its outcome', async () => {
    const handle = vi.fn(() => Promise.resolve<Outcome>('processed'))
    const stats = consumerStats()
    const deliver = deliveryHandler(handle, stats, pino({ level: 'silent' }))

    await deliver({ groupId: 'g1' }, properties())

    expect(handle).toHaveBeenCalledWith({
      exchange: 'b2b',
      routingKey: 'b2b.group.updated',
      messageId: 'm-1',
      body: { groupId: 'g1' }
    })
    expect(stats.outcomes).toEqual(new Map([['processed', 1]]))
  })

  it('dead-letters an event the router rejects', async () => {
    const { deliver } = setup(() => Promise.resolve('rejected'))

    await expect(deliver({}, properties())).rejects.toMatchObject({
      name: 'DeadLetterError'
    })
  })

  it('fails so the message is retried, and counts the failure', async () => {
    const { deliver, stats } = setup(() => Promise.reject(new Error('db down')))

    await expect(deliver({}, properties())).rejects.toThrow('db down')
    expect(stats.outcomes).toEqual(new Map([['failed', 1]]))
  })

  it('warns once when a message has failed for over 25 minutes', async () => {
    let failing = true
    const { deliver, lines } = setup(() =>
      failing
        ? Promise.reject(new Error('db down'))
        : Promise.resolve('processed')
    )

    await deliver({}, properties()).catch(() => undefined)
    await vi.advanceTimersByTimeAsync(24 * 60_000)
    await deliver({}, properties()).catch(() => undefined)
    expect(lines).toEqual([])

    await vi.advanceTimersByTimeAsync(2 * 60_000)
    await deliver({}, properties()).catch(() => undefined)
    await deliver({}, properties()).catch(() => undefined)
    expect(lines.map(line => line.msg)).toEqual([
      'a message has failed for over 25 minutes; the broker may redeliver it'
    ])

    failing = false
    await deliver({}, properties())
    failing = true
    await deliver({}, properties()).catch(() => undefined)
    await vi.advanceTimersByTimeAsync(20 * 60_000)
    await deliver({}, properties()).catch(() => undefined)
    expect(lines).toHaveLength(1)
  })
})

describe('consumerAlive', () => {
  const connected = { isConnected: () => true }

  it('stays alive while idle, and while a handler runs under 5 minutes', async () => {
    let finish: () => void = () => undefined
    const { deliver, stats } = setup(
      () =>
        new Promise(resolve => {
          finish = () => {
            resolve('processed')
          }
        })
    )
    const alive = consumerAlive(connected, stats)
    expect(alive()).toBe(true)

    const delivered = deliver({}, properties())
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    expect(alive()).toBe(true)

    await vi.advanceTimersByTimeAsync(2 * 60_000)
    expect(alive()).toBe(false)

    finish()
    await delivered
    expect(alive()).toBe(true)
  })

  it('rides out a reconnect, and is dead once disconnected for a minute', async () => {
    let connectedNow = false
    const alive = consumerAlive(
      { isConnected: () => connectedNow },
      consumerStats()
    )

    expect(alive()).toBe(true)
    await vi.advanceTimersByTimeAsync(50_000)
    expect(alive()).toBe(true)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(alive()).toBe(false)

    connectedNow = true
    expect(alive()).toBe(true)
    connectedNow = false
    expect(alive()).toBe(true)
  })

  it('is dead when a reconnect fails to restore the subscription', () => {
    const stats = consumerStats()
    const alive = consumerAlive(connected, stats)

    stats.reconnected({ subscriptionsFailed: 0 })
    expect(alive()).toBe(true)

    stats.reconnected({ subscriptionsFailed: 1 })
    expect(alive()).toBe(false)
  })
})

describe('subscription', () => {
  it('binds the queue to each event, and checks the exchanges others own', () => {
    const { exchange, routingKey, queue, options } = subscription(
      amqpTopology.parse({
        AMQP_EVENTS: '{"dns.validated":{"exchange":"dns"}}'
      }).amqp
    )

    expect({ exchange, routingKey, queue }).toEqual({
      exchange: 'space',
      routingKey: 'twake.space.created',
      queue: 'twake-space'
    })
    expect(options.bindings).toHaveLength(18)
    expect(options.bindings).toContainEqual({
      exchange: 'dns',
      routingKey: 'dns.validated'
    })
    expect(options.bindings).toContainEqual({
      exchange: 'activity',
      routingKey: '#'
    })
    expect(options.passiveExchanges).toEqual(['space', 'b2b', 'dns'])
    expect(options.deadLetterExchange).toBe('twake-space.dlx')
    expect(options.queueArguments).toMatchObject({ 'x-delivery-limit': 20 })
  })
})

describe('canonical', () => {
  const topology = amqpTopology.parse({
    AMQP_ACTIVITY_EXCHANGE: 'apps',
    AMQP_EVENTS: '{"chat.deployment.completed":{"routingKey":"deployed"}}'
  }).amqp

  it('names a platform message after the event bound to its key', () => {
    expect(canonical(topology, 'b2b', 'deployed')).toEqual({
      exchange: 'b2b',
      routingKey: 'chat.deployment.completed'
    })
  })

  it('names the activity exchange activity, whatever it is called', () => {
    expect(canonical(topology, 'apps', 'com.twake.tasks.x')).toEqual({
      exchange: 'activity',
      routingKey: 'com.twake.tasks.x'
    })
  })

  it('keeps any other routing key as it came', () => {
    expect(canonical(topology, 'b2b', 'chat.deployment.completed')).toEqual({
      exchange: 'b2b',
      routingKey: 'chat.deployment.completed'
    })
  })
})

describe('deadLetterQueue', () => {
  it('publishes the event straight to the dead letter queue, with its reason', async () => {
    const client = { publish: vi.fn(() => Promise.resolve()) }

    await deadLetterQueue(client, 'twake-space')(
      {
        exchange: 'space',
        routingKey: 'twake.space.member.added',
        messageId: 'm-1',
        body: { spaceId: 'space-1' }
      },
      'unknown space space-1'
    )

    expect(client.publish).toHaveBeenCalledWith(
      '',
      'twake-space.dlq',
      { spaceId: 'space-1' },
      {
        messageId: 'm-1',
        mandatory: true,
        headers: {
          'x-twake-space-exchange': 'space',
          'x-twake-space-routing-key': 'twake.space.member.added',
          'x-twake-space-reason': 'unknown space space-1'
        }
      }
    )
  })
})
