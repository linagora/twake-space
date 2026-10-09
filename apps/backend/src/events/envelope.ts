import { z } from 'zod'

export const ACTIVITY_EXCHANGE = 'activity'

// Ids end up in primary keys, which Postgres caps at about 2.7 KB.
const key = z.string().min(1).max(255)

const cloudEvent = z.looseObject({
  specversion: z.literal('1.0'),
  id: key,
  source: key,
  type: key,
  time: z.iso.datetime({ offset: true }).optional(),
  subject: z.string().optional(),
  // A B2C user has no organization.
  twakeorg: key.optional(),
  // Left out for an action made with an organization token.
  twakeactor: z.email().optional(),
  data: z.looseObject({ object: z.looseObject({}).optional() })
})

export type CloudEvent = z.infer<typeof cloudEvent>

const requestId = z
  .looseObject({ request_id: key })
  .transform(body => body.request_id)

export interface PlatformEvent {
  routingKey: string
  messageId: string
  body: unknown
}

export type ParseResult<T> =
  { ok: true; event: T } | { ok: false; error: string }

export function parseCloudEvent(body: unknown): ParseResult<CloudEvent> {
  const result = cloudEvent.safeParse(body)
  return result.success
    ? { ok: true, event: result.data }
    : { ok: false, error: z.prettifyError(result.error) }
}

export function parsePlatformEvent(message: {
  routingKey: string
  messageId?: string
  body: unknown
}): ParseResult<PlatformEvent> {
  const { routingKey, body } = message
  // Common settings publishes without a message id, and names each message in
  // its body instead.
  const messageId = message.messageId ?? requestId.safeParse(body).data
  if (!messageId) return { ok: false, error: 'missing message id' }
  return { ok: true, event: { routingKey, messageId, body } }
}
