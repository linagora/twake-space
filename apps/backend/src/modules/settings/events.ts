import { lt, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { PlatformEvent } from '../../events/envelope.ts'
import { parseOrDrop, type Handler } from '../../events/router.ts'
import { tellEmail } from '../live/notify.ts'
import { userSettings, type UserSettings } from './schema.ts'

// A field TwakeSpace cannot use is left out rather than refusing the rest.
const optional = <T extends z.ZodType>(schema: T) =>
  schema.optional().catch(undefined)

const updated = z.looseObject({
  nickname: z.string().min(1),
  version: z.number().int(),
  payload: z.looseObject({
    email: z.email().transform(email => email.toLowerCase()),
    language: optional(z.string().min(1)),
    timezone: optional(z.string().min(1)),
    theme: optional(z.enum(['light', 'dark', 'auto'])),
    avatar: optional(z.url({ protocol: /^https?$/ })),
    display_name: optional(z.string().min(1))
  })
})

// Each message holds the whole settings, so a newer version replaces them.
// Versions count per account, so another account behind the email starts over.
const onUpdated: Handler<PlatformEvent> = async (event, tx) => {
  const { nickname, version, payload } = parseOrDrop(
    updated,
    event.body,
    event.routingKey
  )
  const settings: UserSettings = {
    language: payload.language,
    timezone: payload.timezone,
    theme: payload.theme,
    avatar: payload.avatar,
    displayName: payload.display_name
  }
  const stored = await tx
    .insert(userSettings)
    .values({ email: payload.email, nickname, version, settings })
    .onConflictDoUpdate({
      target: userSettings.email,
      set: { nickname, version, settings, updatedAt: sql`now()` },
      setWhere: sql`${lt(userSettings.version, version)} or ${ne(userSettings.nickname, nickname)}`
    })
    .returning({ email: userSettings.email })
  if (stored.length > 0) await tellEmail(tx, 'settings', payload.email)
}

export const settingsPlatformRoutes: ReadonlyMap<
  string,
  Handler<PlatformEvent>
> = new Map([['user.settings.updated', onUpdated]])
