import { vi } from 'vitest'

import { memoryFeed } from '@/adapters/memory/memoryFeed'
import type { FeedItem, FeedService } from '@/application/feed'
import type { SpaceRole } from '@/application/spaces'

/** The feeds are keyed by space id; the caller is `u-me`, an admin unless said. */
export function fakeFeed(
  feeds: Record<string, FeedItem[]> = {},
  {
    roles = {},
    pageSize
  }: { roles?: Record<string, SpaceRole>; pageSize?: number } = {}
): FeedService {
  const feed = memoryFeed(feeds, {
    me: { id: 'u-me', name: 'Me' },
    roles,
    ...(pageSize && { pageSize })
  })
  return {
    list: vi.fn(feed.list),
    item: vi.fn(feed.item),
    post: vi.fn(feed.post),
    edit: vi.fn(feed.edit),
    remove: vi.fn(feed.remove),
    react: vi.fn(feed.react),
    unreact: vi.fn(feed.unreact)
  }
}
