import { eq } from 'drizzle-orm'
import type { Db } from '../../infra/db.ts'
import type { HttpServer } from '../../infra/http.ts'
import type { Authorize } from '../auth/index.ts'
import { userSettings } from './schema.ts'

export function registerSettingsRoutes(
  app: HttpServer,
  deps: { db: Db; authorize: Authorize }
) {
  const { db } = deps

  app.get('/settings', { preHandler: deps.authorize() }, async request => {
    const caller = request.caller
    if (caller?.kind !== 'session') {
      throw new Error('authorize let a request through')
    }
    const [row] = await db
      .select({ settings: userSettings.settings })
      .from(userSettings)
      .where(eq(userSettings.email, caller.email.toLowerCase()))
    const settings = row?.settings ?? {}
    return {
      language: settings.language ?? null,
      timezone: settings.timezone ?? null,
      theme: settings.theme ?? null,
      avatar: settings.avatar ?? null,
      displayName: settings.displayName ?? null
    }
  })
}
