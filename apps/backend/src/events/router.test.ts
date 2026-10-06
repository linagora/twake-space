import { pino } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import type { Tx } from '../infra/db.ts'
import type { Deduplicator, EventKey } from './dedupe.ts'
import type { CloudEvent, PlatformEvent } from './envelope.ts'
import {
  createMessageHandler,
  MalformedEventError,
  NotYetKnownError,
  RejectedEventError,
  type Handler,
  type Park
} from './router.ts'

const tx = {} as Tx

function memoryDeduplicator(): Deduplicator & { keys: EventKey[] } {
  const seen = new Set<string>()
  const keys: EventKey[] = []
  return {
    keys,
    async once(key, process) {
      const id = `${key.source}|${key.id}`
      if (seen.has(id)) return false
      await process(tx)
      seen.add(id)
      keys.push(key)
      return true
    }
  }
}

function setup() {
  const activity = vi.fn<Handler<CloudEvent>>().mockResolvedValue()
  const platform = vi.fn<Handler<PlatformEvent>>().mockResolvedValue()
  const park = vi.fn<Park>().mockResolvedValue()
  const dedupe = memoryDeduplicator()
  const handle = createMessageHandler({
    routes: {
      activity: new Map([['com.twake.drive.file.created.v1', activity]]),
      platform: new Map([['b2b.group.created', platform]])
    },
    dedupe,
    park,
    logger: pino({ level: 'silent' })
  })
  return { handle, activity, platform, park, dedupe }
}

const fileCreated = {
  specversion: '1.0',
  id: 'evt-1',
  source: 'twake://drive',
  type: 'com.twake.drive.file.created.v1',
  twakeorg: 'linagora',
  twakeactor: 'user1@linagora.com',
  data: {
    object: {
      type: 'file',
      id: 'f1',
      container: { kind: 'drive', id: 'drive-1' }
    }
  }
}

const activityMessage = (body: unknown) => ({
  exchange: 'activity',
  routingKey: 'com.twake.drive.file.created.v1',
  body
})

describe('createMessageHandler', () => {
  it('routes an activity event by type and dedupes on source and id', async () => {
    const { handle, activity, dedupe } = setup()

    expect(await handle(activityMessage(fileCreated))).toBe('processed')
    expect(activity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-1' }),
      tx,
      expect.anything()
    )
    expect(dedupe.keys).toEqual([{ source: 'twake://drive', id: 'evt-1' }])
  })

  it('skips a redelivered event', async () => {
    const { handle, activity } = setup()

    await handle(activityMessage(fileCreated))
    expect(await handle(activityMessage(fileCreated))).toBe('duplicate')
    expect(activity).toHaveBeenCalledOnce()
  })

  it('ignores a type without handler', async () => {
    const { handle, activity } = setup()
    const event = { ...fileCreated, type: 'com.twake.drive.file.moved.v1' }

    expect(await handle(activityMessage(event))).toBe('unrouted')
    expect(activity).not.toHaveBeenCalled()
  })

  it('drops a malformed event without calling any handler', async () => {
    const { handle, activity } = setup()

    expect(await handle(activityMessage({ hello: 'world' }))).toBe('malformed')
    expect(activity).not.toHaveBeenCalled()
  })

  it('routes a platform event by routing key and dedupes on message id', async () => {
    const { handle, platform, activity, dedupe } = setup()

    expect(
      await handle({
        exchange: 'b2b',
        routingKey: 'b2b.group.created',
        messageId: 'm-1',
        body: { groupId: 'g1' }
      })
    ).toBe('processed')
    expect(platform).toHaveBeenCalledWith(
      {
        routingKey: 'b2b.group.created',
        messageId: 'm-1',
        body: { groupId: 'g1' }
      },
      tx,
      expect.anything()
    )
    expect(activity).not.toHaveBeenCalled()
    expect(dedupe.keys).toEqual([{ source: 'amqp', id: 'm-1' }])
  })

  it('drops an event its handler finds malformed', async () => {
    const { handle, activity } = setup()
    activity.mockRejectedValueOnce(new MalformedEventError('no space id'))

    expect(await handle(activityMessage(fileCreated))).toBe('malformed')
  })

  it('drops a platform event without a message id', async () => {
    const { handle, platform } = setup()

    expect(
      await handle({
        exchange: 'b2b',
        routingKey: 'b2b.group.created',
        body: { groupId: 'g1' }
      })
    ).toBe('malformed')
    expect(platform).not.toHaveBeenCalled()
  })

  it('rejects an event its handler rejects, without marking it processed', async () => {
    const { handle, activity, dedupe } = setup()
    activity.mockRejectedValueOnce(new RejectedEventError('not a member'))

    expect(await handle(activityMessage(fileCreated))).toBe('rejected')
    expect(dedupe.keys).toEqual([])
  })

  it('parks an event about something the copy does not hold yet', async () => {
    const { handle, activity, park, dedupe } = setup()
    activity.mockRejectedValueOnce(new NotYetKnownError('unknown space'))
    const incoming = activityMessage(fileCreated)

    expect(await handle(incoming)).toBe('parked')
    expect(park).toHaveBeenCalledWith(
      incoming,
      { source: 'twake://drive', id: 'evt-1' },
      'unknown space'
    )
    expect(dedupe.keys).toEqual([])
  })

  it('propagates a handler failure so the message is not acknowledged', async () => {
    const { handle, activity } = setup()
    activity.mockRejectedValueOnce(new Error('db down'))

    await expect(handle(activityMessage(fileCreated))).rejects.toThrow(
      'db down'
    )
    expect(await handle(activityMessage(fileCreated))).toBe('processed')
  })
})
