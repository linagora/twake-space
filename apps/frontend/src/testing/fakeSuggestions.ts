import { vi } from 'vitest'

import type {
  HarnessService,
  Suggestion,
  SuggestionsService
} from '@/application/suggestions'

export function fakeSuggestions(
  initial: Suggestion[] = []
): SuggestionsService & { add: (suggestion: Suggestion) => void } {
  let unread = [...initial]
  return {
    list: vi.fn(() => Promise.resolve([...unread])),
    markRead: vi.fn((id: string) => {
      unread = unread.filter(s => s.id !== id)
      return Promise.resolve()
    }),
    add: suggestion => {
      unread = [...unread, suggestion]
    }
  }
}

export function fakeHarness(): HarnessService {
  return {
    approve: vi.fn(() => Promise.resolve()),
    refuse: vi.fn(() => Promise.resolve())
  }
}
