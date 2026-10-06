import { describe, expect, it } from 'vitest'

import { memoryDirectory } from '@/adapters/memory/memoryDirectory'
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

describe('memoryDirectory', () => {
  const people = [
    {
      id: 'u-alice',
      username: 'alice',
      email: 'alice@acme.test',
      displayName: 'Alice Martin'
    },
    {
      id: 'u-bob',
      username: 'bob',
      email: 'bob@acme.test',
      displayName: 'Bob Durand'
    }
  ]
  const groups = [{ id: 'g-designers', name: 'Designers' }]
  const directory = memoryDirectory({ people, groups }, { pageSize: 1 })

  it('searches people by name, username or email, by page', async () => {
    expect(await directory.people('', 1)).toEqual({
      people: [
        {
          username: 'alice',
          email: 'alice@acme.test',
          displayName: 'Alice Martin'
        }
      ],
      hasNextPage: true
    })
    expect((await directory.people('DURAND', 1)).people).toEqual([
      { username: 'bob', email: 'bob@acme.test', displayName: 'Bob Durand' }
    ])
  })

  it('searches groups by name', async () => {
    expect(await directory.groups('design', 1)).toEqual({
      groups,
      hasNextPage: false
    })
  })
})
