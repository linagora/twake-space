import { useState, type ReactElement } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'

import type { SessionService } from '@/application/session'
import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import { findPreferredLanguage } from '@/ui/i18n/languages'
import { useLiveUpdates } from '@/ui/live/useLiveUpdates'
import type { Services } from '@/ui/services/Services'
import { SessionGate } from '@/ui/session/SessionGate'
import { FollowCommonSettings } from '@/ui/settings/FollowCommonSettings'

export interface AppProps {
  session: SessionService
  services: Services
}

export function App({ session, services }: AppProps): ReactElement {
  const [queryClient] = useState(makeQueryClient)
  const [lang] = useState(findPreferredLanguage)

  return (
    <AppProviders lang={lang} queryClient={queryClient} services={services}>
      <SessionGate session={session}>
        <FollowCommonSettings>
          <AppRouter />
        </FollowCommonSettings>
      </SessionGate>
    </AppProviders>
  )
}

// Created once signed in: the sign-in may move the browser off the redirect URI
function AppRouter(): ReactElement {
  const [router] = useState(() => createBrowserRouter(routes))
  useLiveUpdates()
  return <RouterProvider router={router} />
}
