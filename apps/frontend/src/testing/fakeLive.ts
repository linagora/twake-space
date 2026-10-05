import type { LiveHandlers, LiveService } from '@/application/live'

export function fakeLive(): LiveService & {
  emit: (event: string, data: unknown) => void
  reconnect: () => void
  subscribers: () => number
} {
  const subscribed = new Set<LiveHandlers>()
  return {
    subscribe: handlers => {
      subscribed.add(handlers)
      return () => subscribed.delete(handlers)
    },
    emit: (event, data) => {
      for (const handlers of subscribed) handlers.onEvent(event, data)
    },
    reconnect: () => {
      for (const handlers of subscribed) handlers.onReconnect()
    },
    subscribers: () => subscribed.size
  }
}
