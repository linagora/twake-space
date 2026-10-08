import type { Suggestion, SuggestionsService } from '@/application/suggestions'

// Nothing arrives live: the seed is what there is, until answered.
export function memorySuggestions(seed: Suggestion[]): SuggestionsService {
  let unread = [...seed]
  return {
    list: () => Promise.resolve([...unread]),
    markRead: id => {
      unread = unread.filter(s => s.id !== id)
      return Promise.resolve()
    }
  }
}
