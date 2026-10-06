export const FEED_CATEGORIES = [
  'messages',
  'files',
  'activities',
  'events'
] as const

export type FeedCategory = (typeof FEED_CATEGORIES)[number]

export type FeedFilter = 'all' | FeedCategory

const MESSAGE = 'm.room.message'
const cardType = (category: FeedCategory) => `com.twake.feed.${category}`

// Synapse filters by event type, so each filter is one query on the Matrix space.
export const FEED_TYPES: Record<FeedFilter, string[]> = {
  all: [MESSAGE, ...FEED_CATEGORIES.map(cardType)],
  messages: [MESSAGE, cardType('messages')],
  files: [cardType('files')],
  activities: [cardType('activities')],
  events: [cardType('events')]
}

export type Actor =
  | { type: 'user'; id: string | null; email: string | null }
  | { type: 'token'; id: string; name: string }
  | { type: 'deleted_user' }

export interface FeedObject {
  type: string
  id: string
  title: string
  url: string
}

export type FeedEntry =
  | {
      kind: 'message'
      id: string
      ts: number
      sender: string
      senderName: string
      body: string
    }
  | {
      kind: 'card'
      id: string
      ts: number
      category: FeedCategory
      /** The app that sent the activity, as in `com.twake.<app>.*`. */
      app: string | null
      actor: Actor | null
      object: FeedObject
      preview: string | null
    }

/** A Matrix event, with the content of its latest edit. */
export interface RoomEvent {
  id: string
  type: string
  sender: string
  /** The sender's display name in the room, when the client knows it. */
  senderName?: string | undefined
  ts: number
  content: Record<string, unknown>
}

export interface FeedPage {
  entries: FeedEntry[]
  hasOlder: boolean
}

export interface FeedView {
  loadOlder: () => Promise<void>
  close: () => void
}

export interface FeedService {
  /** Calls onChange with the whole feed, newest last, each time it changes. */
  open: (
    roomId: string,
    filter: FeedFilter,
    onChange: (page: FeedPage) => void
  ) => Promise<FeedView>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isObject(value: unknown): value is FeedObject {
  return (
    isRecord(value) &&
    ['type', 'id', 'title', 'url'].every(key => typeof value[key] === 'string')
  )
}

function isActor(value: unknown): value is Actor {
  return (
    isRecord(value) &&
    (value.type === 'user' ||
      value.type === 'token' ||
      value.type === 'deleted_user')
  )
}

function categoryOf(type: string): FeedCategory | undefined {
  return FEED_CATEGORIES.find(category => cardType(category) === type)
}

export function toFeedEntry(event: RoomEvent): FeedEntry | null {
  const { id, type, sender, senderName = sender, ts, content } = event
  const relation = content['m.relates_to']
  if (isRecord(relation) && relation.rel_type === 'm.replace') return null

  if (type === MESSAGE) {
    const { body } = content
    if (typeof body !== 'string') return null
    return { kind: 'message', id, ts, sender, senderName, body }
  }

  const category = categoryOf(type)
  if (!category || !isObject(content.object)) return null
  const { type: objectType, id: objectId, title, url } = content.object
  return {
    kind: 'card',
    id,
    ts,
    category,
    app:
      typeof content.type === 'string'
        ? (/^com\.twake\.([a-z]+)\./.exec(content.type)?.[1] ?? null)
        : null,
    actor: isActor(content.actor) ? content.actor : null,
    object: { type: objectType, id: objectId, title, url },
    preview: typeof content.preview === 'string' ? content.preview : null
  }
}
