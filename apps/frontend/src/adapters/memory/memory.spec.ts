import { describe, expect, it } from 'vitest'

import { memoryFeed } from '@/adapters/memory/memoryFeed'
import { memorySpaces } from '@/adapters/memory/memorySpaces'
import type { FeedEntry, FeedPage } from '@/application/feed'
import type { Space } from '@/application/spaces'

const roadmap: Space = {
  id: 'roadmap',
  name: 'Roadmap',
  role: 'admin',
  chat: true,
  mail: true,
  homeserverUrl: 'https://matrix.acme.test',
  resources: [{ kind: 'matrix_space', id: '!roadmap:acme.test' }]
}

const message = (ts: number): FeedEntry => ({
  kind: 'message',
  id: `$m${String(ts)}`,
  ts,
  sender: '@bob:acme.test',
  body: `Message ${String(ts)}`
})

const file: FeedEntry = {
  kind: 'card',
  id: '$file',
  ts: 50,
  category: 'files',
  actor: { type: 'user', id: 'u-bob', email: 'bob@acme.test' },
  object: { type: 'file', id: 'f-1', title: 'brief.pdf', url: '#' },
  preview: null
}

describe('memorySpaces', () => {
  it('lists, gets and creates spaces', async () => {
    const spaces = memorySpaces([roadmap])

    const created = await spaces.create('Launch')

    expect(await spaces.list()).toEqual([
      { id: 'roadmap', name: 'Roadmap', role: 'admin' },
      created
    ])
    expect(await spaces.get(created.id)).toMatchObject({
      name: 'Launch',
      role: 'admin'
    })
    await expect(spaces.get('nowhere')).rejects.toMatchObject({ status: 404 })
  })
})

describe('memoryFeed', () => {
  const feed = memoryFeed(
    {
      '!roadmap:acme.test': [
        ...Array.from({ length: 12 }, (_, i) => message(i + 1)),
        file
      ]
    },
    { pageSize: 10 }
  )

  it('opens on the newest page of the filtered entries', async () => {
    const pages: FeedPage[] = []

    await feed.open('!roadmap:acme.test', 'messages', page => pages.push(page))

    expect(pages.at(-1)?.entries.map(entry => entry.ts)).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12
    ])
    expect(pages.at(-1)?.hasOlder).toBe(true)
  })

  it('loads older entries until none are left', async () => {
    const pages: FeedPage[] = []
    const view = await feed.open('!roadmap:acme.test', 'messages', page =>
      pages.push(page)
    )

    await view.loadOlder()

    expect(pages.at(-1)?.entries).toHaveLength(12)
    expect(pages.at(-1)?.hasOlder).toBe(false)
  })

  it('keeps only the cards of a category', async () => {
    const pages: FeedPage[] = []

    await feed.open('!roadmap:acme.test', 'files', page => pages.push(page))

    expect(pages.at(-1)).toEqual({ entries: [file], hasOlder: false })
  })
})
