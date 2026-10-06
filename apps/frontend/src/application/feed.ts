import type { ResourceKind } from '@/application/spaces'

export const FEED_CATEGORIES = [
  'messages',
  'files',
  'activities',
  'events'
] as const

export type FeedCategory = (typeof FEED_CATEGORIES)[number]

export type FeedFilter = 'all' | FeedCategory

/** A user's name is null when they are not a member of the space. */
export type Actor =
  | { type: 'user'; id: string | null; name: string | null }
  | { type: 'token'; id: string; name: string }
  | { type: 'deleted_user' }

/** A card holds ids, never a link: the frontend opens the container's tab. */
export interface FeedObject {
  type: string
  id: string
  title: string
  container: { kind: ResourceKind; id: string } | null
}

export interface Reaction {
  key: string
  /** In the order they reacted. */
  userIds: string[]
}

interface ItemBase {
  id: string
  category: FeedCategory
  time: string
  updatedAt: string
  reactions: Reaction[]
}

/** One card per object: it keeps its first time, and shows the latest event. */
export interface FeedCard extends ItemBase {
  kind: 'card'
  /** The latest activity event type, like `com.twake.tasks.task.moved.v1`. */
  type: string
  actor: Actor | null
  object: FeedObject
  preview: string | null
  state: Record<string, unknown>
}

export interface FeedPost extends ItemBase {
  kind: 'post'
  author: Actor
  body: string
  editedAt: string | null
}

export type FeedItem = FeedCard | FeedPost

/** Newest first. `next` is the cursor of the older page, if any. */
export interface FeedPage {
  items: FeedItem[]
  next: string | null
}

export interface FeedService {
  list: (
    spaceId: string,
    options: { category?: FeedCategory; before?: string }
  ) => Promise<FeedPage>
  item: (spaceId: string, itemId: string) => Promise<FeedItem>
  /** Editors and admins only: a viewer is refused with `cannot_post`. */
  post: (spaceId: string, body: string) => Promise<FeedItem>
  edit: (spaceId: string, postId: string, body: string) => Promise<FeedItem>
  remove: (spaceId: string, postId: string) => Promise<void>
  react: (spaceId: string, itemId: string, key: string) => Promise<void>
  unreact: (spaceId: string, itemId: string, key: string) => Promise<void>
}

/** The `feed` live event. */
export interface FeedChange {
  spaceId: string
  itemId: string
  change: 'added' | 'changed' | 'removed'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function toFeedChange(data: unknown): FeedChange | null {
  if (
    !isRecord(data) ||
    typeof data.spaceId !== 'string' ||
    typeof data.itemId !== 'string'
  ) {
    return null
  }
  const { spaceId, itemId, change } = data
  return change === 'added' || change === 'changed' || change === 'removed'
    ? { spaceId, itemId, change }
    : null
}

export function shows(item: FeedItem, filter: FeedFilter): boolean {
  return filter === 'all' || item.category === filter
}

/** The app that sent a card, as in `com.twake.<app>.*`. */
export function cardApp(card: FeedCard): string | null {
  return /^com\.twake\.([a-z]+)\./.exec(card.type)?.[1] ?? null
}

/** What happened last, as in `com.twake.<app>.<object>.<action>.v1`. */
export function cardAction(card: FeedCard): string | null {
  return /\.([a-z_]+)\.v\d+$/.exec(card.type)?.[1] ?? null
}

export interface TimeRange {
  start: string
  end: string
}

/** A calendar card's state; `allDay` times are dates, `YYYY-MM-DD`. */
export interface EventState extends TimeRange {
  allDay: boolean
  location: string | null
  previous: TimeRange | null
  proposed: (TimeRange & { by: string }) | null
  rsvp: Record<'accepted' | 'declined' | 'tentative' | 'pending', number> | null
}

function toRsvp(value: unknown): EventState['rsvp'] {
  if (!isRecord(value)) return null
  const count = (key: string) =>
    typeof value[key] === 'number' ? value[key] : 0
  return {
    accepted: count('accepted'),
    declined: count('declined'),
    tentative: count('tentative'),
    pending: count('pending')
  }
}

function toRange(value: unknown): TimeRange | null {
  return isRecord(value) &&
    typeof value.start === 'string' &&
    typeof value.end === 'string'
    ? { start: value.start, end: value.end }
    : null
}

export function toEventState(
  state: Record<string, unknown>
): EventState | null {
  const range = toRange(state)
  if (!range) return null
  const proposed = toRange(state.proposed)
  const by = isRecord(state.proposed) ? state.proposed.by : null
  return {
    ...range,
    allDay: state.allDay === true,
    location: typeof state.location === 'string' ? state.location : null,
    previous: toRange(state.previous),
    proposed: proposed && typeof by === 'string' ? { ...proposed, by } : null,
    rsvp: toRsvp(state.rsvp)
  }
}
