import { vi } from 'vitest'

import type { FeedPage, FeedService, FeedView } from '@/application/feed'

export function fakeFeed(
  page: FeedPage = { entries: [], hasOlder: false }
): FeedService & { view: FeedView } {
  const view: FeedView = {
    loadOlder: vi.fn(() => Promise.resolve()),
    close: vi.fn()
  }
  return {
    view,
    open: vi.fn<FeedService['open']>((_roomId, _filter, onChange) => {
      onChange(page)
      return Promise.resolve(view)
    })
  }
}
