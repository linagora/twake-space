import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useServices } from '@/ui/services/Services'
import { followFeedChange } from '@/ui/space/feedQueries'
import { SPACES } from '@/ui/spaces/queries'

export function useLiveUpdates(): void {
  const { live, feed } = useServices()
  const queryClient = useQueryClient()

  useEffect(
    () =>
      live.subscribe({
        onEvent: (event, data) => {
          if (event === 'spaces') {
            void queryClient.invalidateQueries({ queryKey: SPACES })
          }
          if (event === 'feed') followFeedChange(queryClient, feed, data)
        },
        onReconnect: () => void queryClient.invalidateQueries()
      }),
    [live, feed, queryClient]
  )
}
