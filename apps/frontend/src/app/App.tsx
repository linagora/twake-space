import { useState, type ReactElement } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { AppProviders } from '@/app/AppProviders'
import { makeQueryClient } from '@/app/queryClient'
import { routes } from '@/app/routes'
import { findPreferredLanguage } from '@/ui/i18n/languages'

export function App(): ReactElement {
  const [queryClient] = useState(makeQueryClient)
  const [router] = useState(() => createBrowserRouter(routes))
  const [lang] = useState(findPreferredLanguage)

  return (
    <AppProviders lang={lang} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
