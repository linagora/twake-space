import { QueryClient } from '@tanstack/react-query'

import { isRefusal } from '@/application/spaces'

const MAX_QUERY_RETRIES = 2

export function shouldRetryQuery(
  failureCount: number,
  error: unknown
): boolean {
  if (isRefusal(error) && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < MAX_QUERY_RETRIES
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery, refetchOnWindowFocus: false },
      mutations: { retry: false }
    }
  })
}
