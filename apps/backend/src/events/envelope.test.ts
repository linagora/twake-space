import { describe, expect, it } from 'vitest'
import { parseCloudEvent, parsePlatformEvent } from './envelope.ts'

const calendarAccepted = {
  specversion: '1.0',
  id: '01J9Z6K4X8M2Q7R5T3V1W0Y9AB',
  source: 'twake://calendar',
  type: 'com.twake.calendar.event.accepted.v1',
  time: '2026-10-05T09:14:22Z',
  subject: 'event/7f3c2a',
  twakeorg: 'linagora',
  twakeactor: 'user1@linagora.com',
  data: {
    object: {
      type: 'event',
      id: '7f3c2a',
      container: { kind: 'calendar', id: 'cal-1' }
    }
  }
}

describe('parseCloudEvent', () => {
  it('parses a structured mode CloudEvent and keeps extra fields', () => {
    const result = parseCloudEvent(
      Buffer.from(JSON.stringify(calendarAccepted))
    )

    expect(result).toEqual({ ok: true, event: calendarAccepted })
  })

  it('accepts an event outside any space', () => {
    const event = {
      ...calendarAccepted,
      data: { object: { type: 'event', id: '7f3c2a' } }
    }

    expect(parseCloudEvent(JSON.stringify(event)).ok).toBe(true)
  })

  it('accepts an event without an organization', () => {
    const event = { ...calendarAccepted, twakeorg: undefined }

    expect(parseCloudEvent(JSON.stringify(event)).ok).toBe(true)
  })

  it('accepts an event without actor nor object, as a provisioned event', () => {
    const event = {
      specversion: '1.0',
      id: '01J9Z7A2B3C4D5E6F7G8H9J0KM',
      source: 'twake://drive',
      type: 'com.twake.drive.space.provisioned.v1',
      twakeorg: 'linagora',
      data: {
        space_id: '3b9e2c71-5d4a-4f0e-9c8b-1a2d6e7f8091',
        resource: { kind: 'drive', id: 'a1f0c3e2d4b5' }
      }
    }

    expect(parseCloudEvent(JSON.stringify(event)).ok).toBe(true)
  })

  it.each([
    ['invalid JSON', '{'],
    ['an empty message', null],
    [
      'a wrong specversion',
      JSON.stringify({ ...calendarAccepted, specversion: '0.3' })
    ],
    ['a missing id', JSON.stringify({ ...calendarAccepted, id: undefined })],
    [
      'an empty twakeorg',
      JSON.stringify({ ...calendarAccepted, twakeorg: '' })
    ],
    [
      'a twakeactor that is not an email',
      JSON.stringify({ ...calendarAccepted, twakeactor: 'user1' })
    ]
  ])('rejects %s', (_case, value) => {
    expect(parseCloudEvent(value).ok).toBe(false)
  })
})

describe('parsePlatformEvent', () => {
  const body = { groupId: 'g1', organizationId: 'linagora' }

  it('reads routing key and message id from the AMQP headers', () => {
    const result = parsePlatformEvent(Buffer.from(JSON.stringify(body)), {
      amqp_routing_key: Buffer.from('b2b.group.created'),
      amqp_message_id: Buffer.from('msg-1')
    })

    expect(result).toEqual({
      ok: true,
      event: { routingKey: 'b2b.group.created', messageId: 'msg-1', body }
    })
  })

  it('rejects a message without amqp_message_id', () => {
    const result = parsePlatformEvent(JSON.stringify(body), {
      amqp_routing_key: 'b2b.group.created'
    })

    expect(result.ok).toBe(false)
  })
})
