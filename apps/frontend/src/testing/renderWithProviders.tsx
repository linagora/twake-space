import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'

import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import type { SupportedLanguage } from '@/ui/i18n/languages'

export function renderWithProviders(
  ui: ReactElement,
  { lang = 'en' }: { lang?: SupportedLanguage } = {}
): RenderResult {
  return render(
    <AppProviders lang={lang} queryClient={makeQueryClient()}>
      {ui}
    </AppProviders>
  )
}
