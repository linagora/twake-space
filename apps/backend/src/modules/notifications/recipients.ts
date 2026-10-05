import { inArray } from 'drizzle-orm'
import type { Logger } from 'pino'
import { z } from 'zod'
import type { Tx } from '../../infra/db.ts'
import { spaceMembers } from '../spaces/schema.ts'
import {
  notifications,
  notificationSettings,
  type notificationType
} from './schema.ts'

type NotificationType = (typeof notificationType.enumValues)[number]

const TYPES = {
  mentioned: 'card_mention',
  invited: 'invitation',
  attendee: 'attended_event_change',
  member: 'space_change'
} as const satisfies Record<string, NotificationType>

const recipient = z.looseObject({
  uuid: z.uuid().optional(),
  email: z.email(),
  reason: z.enum(Object.keys(TYPES) as (keyof typeof TYPES)[])
})

export async function notifyRecipients(
  tx: Tx,
  log: Logger,
  event: {
    id: string
    organizationId: string | null
    spaceId: string | null
  },
  sent: unknown[]
) {
  // A bad entry costs that recipient only, not the card.
  const recipients = sent.flatMap(r => {
    const parsed = recipient.safeParse(r)
    return parsed.success ? [parsed.data] : []
  })
  if (recipients.length < sent.length) {
    log.warn(
      { invalid: sent.length - recipients.length },
      'skipping invalid recipients'
    )
  }
  const emails = recipients.flatMap(r => (r.uuid ? [] : [r.email]))
  const known = new Map<string, string>()
  if (emails.length > 0) {
    const rows = await tx
      .selectDistinct({
        email: spaceMembers.email,
        userId: spaceMembers.userId
      })
      .from(spaceMembers)
      .where(inArray(spaceMembers.email, emails))
    for (const row of rows) known.set(row.email, row.userId)
  }
  const wanted = recipients.flatMap(r => {
    const userId = r.uuid ?? known.get(r.email)
    return userId ? [{ userId, type: TYPES[r.reason] }] : []
  })
  if (wanted.length < recipients.length) {
    log.warn(
      { unknown: recipients.length - wanted.length },
      'recipients not found in the copy'
    )
  }
  if (wanted.length === 0) return

  const choices = await tx
    .select()
    .from(notificationSettings)
    .where(
      inArray(
        notificationSettings.userId,
        wanted.map(w => w.userId)
      )
    )
  const enabled = new Map(
    choices.map(c => [`${c.userId}|${c.type}`, c.enabled])
  )
  const rows = wanted
    .filter(
      w => enabled.get(`${w.userId}|${w.type}`) ?? w.type !== 'space_change'
    )
    .map(w => ({
      ...w,
      organizationId: event.organizationId,
      spaceId: event.spaceId,
      activityEventId: event.id,
      payload: {}
    }))
  if (rows.length === 0) return
  await tx.insert(notifications).values(rows).onConflictDoNothing()
}
