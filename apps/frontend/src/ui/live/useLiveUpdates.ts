import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useServices } from '@/ui/services/Services'
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
        },
        onReconnect: () => void queryClient.invalidateQueries()
      }),
    [live, queryClient]
  )
}
