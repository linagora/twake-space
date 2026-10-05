import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'

import type { LiveService } from '@/application/live'
import type { SessionService } from '@/application/session'
import type { SpacesService } from '@/application/spaces'
import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import { fakeLive } from '@/testing/fakeLive'
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
    live = fakeLive(),
    path = '/',
    tasksUrl = 'https://tasks.test/'
  }: {
    lang?: SupportedLanguage
    session?: SessionService
    spaces?: SpacesService
    live?: LiveService
    path?: string
    tasksUrl?: string | null
  } = {}
): RenderResult {
  return render(
    <AppProviders
      lang={lang}
      queryClient={makeQueryClient()}
      services={{ spaces, live, tasksUrl }}
    >
      <SessionGate session={session}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </SessionGate>
    </AppProviders>
  )
}
