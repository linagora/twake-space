import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useServices } from '@/ui/services/Services'
import { SETTINGS } from '@/ui/settings/useCommonSettings'
import { SPACES } from '@/ui/spaces/queries'

export function useLiveUpdates(): void {
  const { live } = useServices()
  const queryClient = useQueryClient()

  useEffect(
    () =>
      live.subscribe({
        onEvent: event => {
          if (event === 'spaces') {
            void queryClient.invalidateQueries({ queryKey: SPACES })
          }
          if (event === 'settings') {
            void queryClient.invalidateQueries({ queryKey: SETTINGS })
          }
        },
        onReconnect: () => void queryClient.invalidateQueries()
      }),
    [live, queryClient]
  )
}
