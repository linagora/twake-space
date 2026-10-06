import type { FeedEntry, FeedFilter, FeedService } from '@/application/feed'

function shows(entry: FeedEntry, filter: FeedFilter): boolean {
  if (filter === 'all') return true
  return entry.kind === 'message'
    ? filter === 'messages'
    : entry.category === filter
}

export function memoryFeed(
  rooms: Record<string, FeedEntry[]>,
  { pageSize = 10 } = {}
): FeedService {
  return {
    open(roomId, filter, onChange) {
      const entries = (rooms[roomId] ?? [])
        .filter(entry => shows(entry, filter))
        .sort((a, b) => a.ts - b.ts)
      let shown = Math.min(pageSize, entries.length)
      const emit = () => {
        onChange({
          entries: entries.slice(entries.length - shown),
          hasOlder: shown < entries.length
        })
      }
      emit()
      return Promise.resolve({
        loadOlder: () => {
          shown = Math.min(shown + pageSize, entries.length)
          emit()
          return Promise.resolve()
        },
        close: () => undefined
      })
    }
  }
}
