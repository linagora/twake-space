import {
  shows,
  type FeedItem,
  type FeedPost,
  type FeedService
} from '@/application/feed'
import type { Refusal, SpaceRole } from '@/application/spaces'

const refuse = (status: number, code: string) =>
  Promise.reject(
    Object.assign(new Error(code), { status, code } satisfies Refusal)
  )

const newestFirst = (a: FeedItem, b: FeedItem) => b.time.localeCompare(a.time)

// Writes behave like the backend's: viewers cannot post, and only the author
// edits or deletes a post. Nothing arrives live.
export function memoryFeed(
  seed: Record<string, FeedItem[]>,
  {
    me,
    roles,
    pageSize = 10
  }: {
    me: { id: string; name: string | null }
    roles: Record<string, SpaceRole>
    pageSize?: number
  }
): FeedService {
  const spaces = new Map(
    Object.entries(seed).map(([id, items]) => [id, structuredClone(items)])
  )
  const itemsOf = (spaceId: string) => {
    const items = spaces.get(spaceId) ?? []
    spaces.set(spaceId, items)
    return items
  }
  const find = (spaceId: string, itemId: string) =>
    itemsOf(spaceId).find(item => item.id === itemId)
  const myPost = (spaceId: string, postId: string) => {
    const post = find(spaceId, postId)
    if (post?.kind !== 'post') return refuse(404, 'not_found')
    if (post.author.type !== 'user' || post.author.id !== me.id) {
      return refuse(403, 'not_author')
    }
    return Promise.resolve(post)
  }

  return {
    list: (spaceId, { category, before }) => {
      const items = itemsOf(spaceId)
        .filter(item => shows(item, category ?? 'all'))
        .sort(newestFirst)
      const start = before
        ? items.findIndex(i => i.id === before) + 1 || items.length
        : 0
      const page = items.slice(start, start + pageSize)
      return Promise.resolve({
        items: structuredClone(page),
        next: start + pageSize < items.length ? (page.at(-1)?.id ?? null) : null
      })
    },
    item: (spaceId, itemId) => {
      const item = find(spaceId, itemId)
      return item
        ? Promise.resolve(structuredClone(item))
        : refuse(404, 'not_found')
    },
    post: (spaceId, body) => {
      if (roles[spaceId] === 'viewer') return refuse(403, 'cannot_post')
      const time = new Date().toISOString()
      const post: FeedPost = {
        id: crypto.randomUUID(),
        kind: 'post',
        category: 'messages',
        time,
        updatedAt: time,
        reactions: [],
        author: { type: 'user', ...me },
        body,
        editedAt: null
      }
      itemsOf(spaceId).push(post)
      return Promise.resolve(structuredClone(post))
    },
    edit: async (spaceId, postId, body) => {
      const post = await myPost(spaceId, postId)
      post.body = body
      post.editedAt = post.updatedAt = new Date().toISOString()
      return structuredClone(post)
    },
    remove: async (spaceId, postId) => {
      await myPost(spaceId, postId)
      spaces.set(
        spaceId,
        itemsOf(spaceId).filter(item => item.id !== postId)
      )
    },
    react: (spaceId, itemId, key) => {
      const item = find(spaceId, itemId)
      if (!item) return refuse(404, 'not_found')
      const reaction = item.reactions.find(r => r.key === key)
      if (!reaction) item.reactions.push({ key, userIds: [me.id] })
      else if (!reaction.userIds.includes(me.id)) reaction.userIds.push(me.id)
      return Promise.resolve()
    },
    unreact: (spaceId, itemId, key) => {
      const item = find(spaceId, itemId)
      if (!item) return refuse(404, 'not_found')
      item.reactions = item.reactions
        .map(r =>
          r.key === key
            ? { key, userIds: r.userIds.filter(id => id !== me.id) }
            : r
        )
        .filter(r => r.userIds.length > 0)
      return Promise.resolve()
    }
  }
}
