import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'

import type { DirectoryService } from '@/application/directory'
import type { FeedService } from '@/application/feed'
import type { LiveService } from '@/application/live'
import type { MatrixService } from '@/application/matrix'
import type { SessionService } from '@/application/session'
import type { SpacesService } from '@/application/spaces'
import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import { fakeDirectory } from '@/testing/fakeDirectory'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeLive } from '@/testing/fakeLive'
import { fakeMatrix } from '@/testing/fakeMatrix'
import { fakeSession } from '@/testing/fakeSession'
import { fakeSpaces } from '@/testing/fakeSpaces'
import type { SupportedLanguage } from '@/ui/i18n/languages'
import { SessionGate } from '@/ui/session/SessionGate'

export function renderWithProviders(
  ui: ReactElement,
  {
    lang = 'en',
    session = fakeSession(),
    spaces = fakeSpaces(),
    directory = fakeDirectory(),
    live = fakeLive(),
    matrix = fakeMatrix(),
    feed = fakeFeed(),
    path = '/',
    tasksUrl = 'https://tasks.test/'
  }: {
    lang?: SupportedLanguage
    session?: SessionService
    spaces?: SpacesService
    directory?: DirectoryService
    live?: LiveService
    matrix?: MatrixService
    feed?: FeedService
    path?: string
    tasksUrl?: string | null
  } = {}
): RenderResult {
  return render(
    <AppProviders
      lang={lang}
      queryClient={makeQueryClient()}
      services={{ spaces, directory, live, matrix, feed, tasksUrl }}
    >
      <SessionGate session={session}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </SessionGate>
    </AppProviders>
  )
}
