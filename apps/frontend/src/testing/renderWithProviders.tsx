import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'

import type { DirectoryService } from '@/application/directory'
import type { FeedService } from '@/application/feed'
import type { LiveService } from '@/application/live'
import type { MatrixService } from '@/application/matrix'
import type { SessionService } from '@/application/session'
import type { SettingsService } from '@/application/settings'
import type { SpacesService } from '@/application/spaces'
import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import { fakeDirectory } from '@/testing/fakeDirectory'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeLive } from '@/testing/fakeLive'
import { fakeMatrix } from '@/testing/fakeMatrix'
import { fakeSession } from '@/testing/fakeSession'
import { fakeSettings } from '@/testing/fakeSettings'
import { fakeSpaces } from '@/testing/fakeSpaces'
import type { SupportedLanguage } from '@/ui/i18n/languages'
import { SessionGate } from '@/ui/session/SessionGate'
import { FollowCommonSettings } from '@/ui/settings/FollowCommonSettings'

interface Options {
  lang?: SupportedLanguage
  session?: SessionService
  spaces?: SpacesService
  settings?: SettingsService
  directory?: DirectoryService
  live?: LiveService
  matrix?: MatrixService
  feed?: FeedService
  path?: string
  tasksUrl?: string | null
  mailUrl?: string | null
}

function withProviders(
  router: ReactElement,
  {
    lang = 'en',
    session = fakeSession(),
    spaces = fakeSpaces(),
    settings = fakeSettings(),
    directory = fakeDirectory(),
    live = fakeLive(),
    matrix = fakeMatrix(),
    feed = fakeFeed(),
    tasksUrl = 'https://tasks.test/',
    mailUrl = 'https://mail.test/'
  }: Options
): ReactElement {
  return (
    <AppProviders
      lang={lang}
      queryClient={makeQueryClient()}
      services={{
        spaces,
        settings,
        directory,
        live,
        matrix,
        feed,
        tasksUrl,
        mailUrl
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
): RenderResult {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(withProviders(<RouterProvider router={router} />, options))
}
