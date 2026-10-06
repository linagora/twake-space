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
  members: [
    {
      id: 'u-alice',
      username: 'alice',
      email: 'alice@acme.test',
      role: 'admin'
    }
  ],
  groups: [],
  resources: [{ kind: 'matrix_space', id: '!roadmap:acme.test' }]
}

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

const message = (ts: number): FeedEntry => ({
  kind: 'message',
  id: `$m${String(ts)}`,
  ts,
  sender: '@bob:acme.test',
  senderName: 'Bob',
  body: `Message ${String(ts)}`
})

const file: FeedEntry = {
  kind: 'card',
  id: '$file',
  ts: 50,
  category: 'files',
  app: 'drive',
  actor: { type: 'user', id: 'u-bob', email: 'bob@acme.test' },
  object: { type: 'file', id: 'f-1', title: 'brief.pdf', url: '#' },
  preview: null
}

describe('memorySpaces', () => {
  it('renames and removes a space', async () => {
    const spaces = memorySpaces([roadmap], { people, groups })

    await spaces.rename('roadmap', 'Roadmap 2027')
    expect(await spaces.list()).toEqual([
      { id: 'roadmap', name: 'Roadmap 2027', role: 'admin' }
    ])
    await spaces.remove('roadmap')
    expect(await spaces.list()).toEqual([])
  })

  it('adds, changes and removes members', async () => {
    const spaces = memorySpaces([roadmap], { people, groups })

    await spaces.addMembers('roadmap', ['bob'], 'viewer')
    await spaces.setMemberRole('roadmap', 'u-bob', 'editor')
    expect((await spaces.get('roadmap')).members).toContainEqual({
      id: 'u-bob',
      username: 'bob',
      email: 'bob@acme.test',
      role: 'editor'
    })
    await spaces.removeMember('roadmap', 'u-bob')
    expect((await spaces.get('roadmap')).members).toHaveLength(1)
  })

  it('links, changes and unlinks groups', async () => {
    const spaces = memorySpaces([roadmap], { people, groups })

    await spaces.linkGroups('roadmap', ['g-designers'], 'viewer')
    await spaces.setGroupRole('roadmap', 'g-designers', 'editor')
    expect((await spaces.get('roadmap')).groups).toEqual([
      { id: 'g-designers', name: 'Designers', role: 'editor' }
    ])
    await spaces.unlinkGroup('roadmap', 'g-designers')
    expect((await spaces.get('roadmap')).groups).toEqual([])
  })

  it('refuses a write on a space the caller does not administer', async () => {
    const spaces = memorySpaces([{ ...roadmap, role: 'editor' }], {
      people,
      groups
    })

    await expect(spaces.rename('roadmap', 'Q3')).rejects.toMatchObject({
      status: 403,
      code: 'not_space_admin'
    })
  })

  it('lists, gets and creates spaces', async () => {
    const spaces = memorySpaces([roadmap], { people, groups })

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
