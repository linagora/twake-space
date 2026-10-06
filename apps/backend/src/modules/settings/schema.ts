import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamptz } from '../../infra/db.ts'

// Undefined fields are left out of the stored JSON.
export interface UserSettings {
  language?: string | undefined
  timezone?: string | undefined
  theme?: 'light' | 'dark' | 'auto' | undefined
  avatar?: string | undefined
  displayName?: string | undefined
}

// The latest settings common settings published for a person, by lowercased
// email: the only key it shares with TwakeSpace.
export const userSettings = pgTable('user_settings', {
  email: text().primaryKey(),
  nickname: text().notNull(),
  version: integer().notNull(),
  settings: jsonb().$type<UserSettings>().notNull(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow()
})
