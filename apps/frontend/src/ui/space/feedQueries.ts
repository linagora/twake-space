import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey
} from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'

import {
  shows,
  toFeedChange,
  type FeedFilter,
  type FeedItem,
  type FeedPage
} from '@/application/feed'
import { useServices } from '@/ui/services/Services'

const feedKey = (spaceId: string, filter?: FeedFilter): QueryKey =>
  filter ? ['feed', spaceId, filter] : ['feed', spaceId]

export function useFeed(spaceId: string, filter: FeedFilter) {
  const { feed } = useServices()
  return useInfiniteQuery({
    queryKey: feedKey(spaceId, filter),
    queryFn: ({ pageParam }) =>
      feed.list(spaceId, {
        ...(filter !== 'all' && { category: filter }),
        ...(pageParam && { before: pageParam })
      }),
    initialPageParam: '',
    getNextPageParam: page => page.next
  })
}

type Pages = InfiniteData<FeedPage, string>

function withItem(data: Pages, item: FeedItem, filter: FeedFilter): Pages {
  const known = data.pages.some(page => page.items.some(i => i.id === item.id))
  if (known) {
    return {
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        items: page.items.map(i => (i.id === item.id ? item : i))
      }))
    }
  }
  if (!shows(item, filter)) return data
  const [first, ...rest] = data.pages
  if (!first) return data
  return {
    ...data,
    pages: [{ ...first, items: [item, ...first.items] }, ...rest]
  }
}

function withoutItem(data: Pages, itemId: string): Pages {
  return {
    ...data,
    pages: data.pages.map(page => ({
      ...page,
      items: page.items.filter(i => i.id !== itemId)
    }))
  }
}

/**
 * Writes an item into every loaded filter of the space's feed: a known one is
 * replaced in place, a new one goes on top of the filters that show it.
 */
export function useFeedCache(spaceId: string) {
  const queryClient = useQueryClient()
  const put = useCallback(
    (item: FeedItem) => {
      for (const [key, data] of queryClient.getQueriesData<Pages>({
        queryKey: feedKey(spaceId)
      })) {
        const filter = key[2] as FeedFilter
        if (data) queryClient.setQueryData(key, withItem(data, item, filter))
      }
    },
    [queryClient, spaceId]
  )
  const drop = useCallback(
    (itemId: string) => {
      queryClient.setQueriesData<Pages>(
        { queryKey: feedKey(spaceId) },
        data => data && withoutItem(data, itemId)
      )
    },
    [queryClient, spaceId]
  )
  return { put, drop }
}

/** Follows the `feed` live events of one space. */
export function useFeedLive(spaceId: string): void {
  const { live, feed } = useServices()
  const { put, drop } = useFeedCache(spaceId)

  useEffect(
    () =>
      live.subscribe({
        onEvent: (event, data) => {
          const change = event === 'feed' ? toFeedChange(data) : null
          if (change?.spaceId !== spaceId) return
          if (change.change === 'removed') {
            drop(change.itemId)
            return
          }
          feed.item(spaceId, change.itemId).then(put, () => {
            drop(change.itemId)
          })
        },
        onReconnect: () => undefined
      }),
    [live, feed, spaceId, put, drop]
  )
}
