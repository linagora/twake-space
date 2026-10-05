import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'

import type { SessionService } from '@/application/session'
import type { SpacesService } from '@/application/spaces'
import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import { fakeSession } from '@/testing/fakeSession'
import { fakeSpaces } from '@/testing/fakeSpaces'
import type { SupportedLanguage } from '@/ui/i18n/languages'
import { SessionGate } from '@/ui/session/SessionGate'

export function renderWithProviders(
  ui: ReactElement,
  {
    lang = 'en',
    session = fakeSession(),
    spaces = fakeSpaces()
  }: {
    lang?: SupportedLanguage
    session?: SessionService
    spaces?: SpacesService
  } = {}
): RenderResult {
  return render(
    <AppProviders
      lang={lang}
      queryClient={makeQueryClient()}
      services={{ spaces }}
    >
      <SessionGate session={session}>
        <MemoryRouter>{ui}</MemoryRouter>
      </SessionGate>
    </AppProviders>
  )
}
