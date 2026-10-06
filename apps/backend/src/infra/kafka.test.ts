import { pino } from 'pino'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVITY_TOPICS, PLATFORM_TOPIC } from '../events/envelope.ts'
import type { IncomingMessage, Outcome } from '../events/router.ts'
import {
  checkDeadLetterTopics,
  consumerAlive,
  consumerStats,
  eachMessageWithBackoff,
  kafkaLogger
} from './kafka.ts'

const topic = 'twake.drive.events.v1'
const message = (offset: string): IncomingMessage => ({
  value: Buffer.from('{}'),
  offset
})

function setup(
  handle: (topic: string, m: IncomingMessage) => Promise<Outcome>
) {
  const consumer = {
    pause: vi.fn(),
    resume: vi.fn(),
    commitOffsets: vi.fn().mockResolvedValue(undefined)
  }
  const stats = consumerStats()
  const eachMessage = eachMessageWithBackoff(
    consumer,
    handle,
    pino({ level: 'silent' }),
    stats
  )
  const deliver = (offset: string) =>
    eachMessage({ topic, partition: 2, message: message(offset) })
  return { consumer, deliver, stats }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('kafkaLogger', () => {
  it("keeps the client's report of a failed message out of the error level", () => {
    const lines: { level: number; msg: string }[] = []
    const kafka = kafkaLogger(
      pino(
        { level: 'debug' },
        {
          write: (line: string) => {
            lines.push(JSON.parse(line) as { level: number; msg: string })
          }
        }
      )
    )

    kafka.error('Consumer encountered error while processing message: boom')
    kafka.error('Error: all broker connections are down')

    expect(lines.map(({ level, msg }) => ({ level, msg }))).toEqual([
      {
        level: 20,
        msg: 'Consumer encountered error while processing message: boom'
      },
      { level: 50, msg: 'Error: all broker connections are down' }
    ])
  })
})

describe('checkDeadLetterTopics', () => {
  it('names every source topic whose dead letter topic is missing', async () => {
    const present = [...ACTIVITY_TOPICS, PLATFORM_TOPIC]
      .filter(t => t !== 'twake.mail.events.v1')
      .map(t => `${t}.dlq.twake-space`)

    await expect(
      checkDeadLetterTopics({ listTopics: () => Promise.resolve(present) })
    ).rejects.toThrow(
      'missing dead letter topics: twake.mail.events.v1.dlq.twake-space'
    )
    await expect(
      checkDeadLetterTopics({
        listTopics: () =>
          Promise.resolve([...present, 'twake.mail.events.v1.dlq.twake-space'])
      })
    ).resolves.toBeUndefined()
  })
})

describe('consumerAlive', () => {
  const connected = { assignment: () => [] }

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
    expect(consumerAlive(connected, stats)).toBe(true)

    const delivered = deliver('1')
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    expect(consumerAlive(connected, stats)).toBe(true)

    await vi.advanceTimersByTimeAsync(2 * 60_000)
    expect(consumerAlive(connected, stats)).toBe(false)

    finish()
    await delivered
    expect(consumerAlive(connected, stats)).toBe(true)
  })

  it('is dead once the consumer is disconnected', () => {
    const disconnected = {
      assignment: () => {
        throw new Error('Assignment can only be called while connected.')
      }
    }

    expect(consumerAlive(disconnected, consumerStats())).toBe(false)
  })
})

describe('eachMessageWithBackoff', () => {
  it('commits the offset after the message', async () => {
    const { consumer, deliver } = setup(() => Promise.resolve('processed'))

    await deliver('41')

    expect(consumer.commitOffsets).toHaveBeenCalledWith([
      { topic, partition: 2, offset: '42' }
    ])
  })

  it('counts each outcome, failures included', async () => {
    const handle = vi
      .fn<(topic: string, m: IncomingMessage) => Promise<Outcome>>()
      .mockResolvedValueOnce('processed')
      .mockResolvedValueOnce('parked')
      .mockRejectedValueOnce(new Error('ldap-rest down'))
      .mockResolvedValueOnce('processed')
    const { deliver, stats } = setup(handle)

    await deliver('1')
    await deliver('2')
    await deliver('3').catch(() => undefined)
    await deliver('3')

    expect(Object.fromEntries(stats.outcomes)).toEqual({
      processed: 2,
      parked: 1,
      failed: 1
    })
  })

  it('pauses the partition when the commit fails', async () => {
    const { consumer, deliver } = setup(() => Promise.resolve('processed'))
    consumer.commitOffsets.mockRejectedValueOnce(new Error('rebalancing'))

    await expect(deliver('41')).rejects.toThrow('rebalancing')
    expect(consumer.pause).toHaveBeenCalledWith([{ topic, partitions: [2] }])
  })

  it('pauses the partition after a failure, longer each time, and starts over after a success', async () => {
    const handle = vi
      .fn<(topic: string, m: IncomingMessage) => Promise<Outcome>>()
      .mockRejectedValue(new Error('ldap-rest down'))
    const { consumer, deliver } = setup(handle)
    const pausedFor = async () => {
      await expect(deliver('7')).rejects.toThrow('ldap-rest down')
      expect(consumer.pause).toHaveBeenLastCalledWith([
        { topic, partitions: [2] }
      ])
      const resumes = consumer.resume.mock.calls.length
      let waited = 0
      while (consumer.resume.mock.calls.length === resumes) {
        await vi.advanceTimersByTimeAsync(500)
        waited += 500
      }
      expect(consumer.resume).toHaveBeenLastCalledWith([
        { topic, partitions: [2] }
      ])
      return waited
    }

    const waits = []
    for (let i = 0; i < 8; i++) waits.push(await pausedFor())
    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000])
    expect(consumer.commitOffsets).not.toHaveBeenCalled()

    handle.mockResolvedValueOnce('processed')
    await deliver('7')
    expect(await pausedFor()).toBe(1000)
  })
})
