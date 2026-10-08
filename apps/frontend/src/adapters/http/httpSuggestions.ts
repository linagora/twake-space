import type { KyInstance } from 'ky'

import type { Suggestion, SuggestionsService } from '@/application/suggestions'

interface Page {
  notifications: {
    id: string
    type: string
    read: boolean
    payload: { text?: unknown; pendingCallId?: unknown }
  }[]
}

export function httpSuggestions(api: KyInstance): SuggestionsService {
  return {
    list: async () => {
      // ponytail: the 100 newest; older unread suggestions wait for a page of their own.
      const { notifications } = await api
        .get('notifications', { searchParams: { limit: 100 } })
        .json<Page>()
      return notifications
        .flatMap(({ id, type, read, payload }): Suggestion[] =>
          type === 'assistant_suggestion' &&
          !read &&
          typeof payload.text === 'string' &&
          typeof payload.pendingCallId === 'string'
            ? [{ id, text: payload.text, pendingCallId: payload.pendingCallId }]
            : []
        )
        .reverse()
    },
    markRead: async id => {
      await api.post(`notifications/${encodeURIComponent(id)}/read`)
    }
  }
}
