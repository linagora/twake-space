import { getAccessToken } from '@linagora/twake-oidc'
import ky from 'ky'

import type { FoundTask, TaskSearchService } from '@/application/taskSearch'

// Twake Tasks takes Twake Space's own token on its search route alone.
export function httpTaskSearch(tasksUrl: string): TaskSearchService {
  const tasks = ky.create({
    prefixUrl: new URL('api/', tasksUrl).href,
    retry: 0,
    hooks: {
      beforeRequest: [
        request => {
          const token = getAccessToken()
          if (token) request.headers.set('Authorization', `Bearer ${token}`)
        }
      ]
    }
  })
  return {
    search: async q =>
      (
        await tasks
          .get('search', { searchParams: { q } })
          .json<{ tasks: FoundTask[] }>()
      ).tasks
  }
}
