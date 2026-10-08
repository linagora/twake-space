import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

import { I18nProvider } from '@/ui/i18n/I18nProvider'
import type { SupportedLanguage } from '@/ui/i18n/languages'
import { ServicesContext, type Services } from '@/ui/services/Services'
import { BadgesProvider } from '@/ui/space/Badges'
import { FillPageProvider } from '@/ui/space/FillPage'

export interface AppProvidersProps {
  lang: SupportedLanguage
  queryClient: QueryClient
  services: Services
  children: ReactNode
}

export function AppProviders({
  lang,
  queryClient,
  services,
  children
}: AppProvidersProps): ReactElement {
  return (
    <TwakeMuiThemeProvider>
      <I18nProvider lang={lang}>
        <QueryClientProvider client={queryClient}>
          <ServicesContext value={services}>
            <BadgesProvider>
              <FillPageProvider>{children}</FillPageProvider>
            </BadgesProvider>
          </ServicesContext>
        </QueryClientProvider>
      </I18nProvider>
    </TwakeMuiThemeProvider>
  )
}
