import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'

import type { DirectoryService } from '@/application/directory'
import type { FeedbackService } from '@/application/feedback'
import type { FeedService } from '@/application/feed'
import type { LiveService } from '@/application/live'
import type { SessionService } from '@/application/session'
import type { SettingsService } from '@/application/settings'
import type { SpacesService } from '@/application/spaces'
import type { TokensService } from '@/application/tokens'
import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import { fakeDirectory } from '@/testing/fakeDirectory'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeLive } from '@/testing/fakeLive'
import { fakeSession } from '@/testing/fakeSession'
import { fakeSettings } from '@/testing/fakeSettings'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { fakeTokens } from '@/testing/fakeTokens'
import type { SupportedLanguage } from '@/ui/i18n/languages'
import { SessionGate } from '@/ui/session/SessionGate'
import { FollowCommonSettings } from '@/ui/settings/FollowCommonSettings'

interface Options {
  lang?: SupportedLanguage
  session?: SessionService
  spaces?: SpacesService
  tokens?: TokensService
  settings?: SettingsService
  directory?: DirectoryService
  live?: LiveService
  feed?: FeedService
  feedback?: FeedbackService | null
  path?: string
  tasksUrl?: string | null
  mailUrl?: string | null
  driveUrlTemplate?: string | null
  chatUrl?: string | null
  calendarUrl?: string | null
  meetUrl?: string | null
}

function withProviders(
  router: ReactElement,
  {
    lang = 'en',
    session = fakeSession(),
    spaces = fakeSpaces(),
    tokens = fakeTokens(),
    settings = fakeSettings(),
    directory = fakeDirectory(),
    live = fakeLive(),
    feed = fakeFeed(),
    feedback = null,
    tasksUrl = 'https://tasks.test/',
    mailUrl = 'https://mail.test/',
    driveUrlTemplate = 'https://{slug}-drive.{domain}/',
    chatUrl = 'https://chat.test/',
    calendarUrl = 'https://calendar.test/',
    meetUrl = 'https://meet.test'
  }: Options
): ReactElement {
  return (
    <AppProviders
      lang={lang}
      queryClient={makeQueryClient()}
      services={{
        spaces,
        tokens,
        settings,
        directory,
        live,
        feed,
        feedback,
        apiUrl: 'https://space.test/api/',
        tasksUrl,
        mailUrl,
        driveUrlTemplate,
        chatUrl,
        calendarUrl,
        meetUrl
      }}
    >
      <SessionGate session={session}>
        <FollowCommonSettings>{router}</FollowCommonSettings>
      </SessionGate>
    </AppProviders>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: Options = {}
): RenderResult {
  return render(
    withProviders(
      <MemoryRouter initialEntries={[options.path ?? '/']}>{ui}</MemoryRouter>,
      options
    )
  )
}

export function renderRoute(
  path: string,
  options: Omit<Options, 'path'> = {}
): RenderResult & { router: ReturnType<typeof createMemoryRouter> } {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return {
    ...render(withProviders(<RouterProvider router={router} />, options)),
    router
  }
}
