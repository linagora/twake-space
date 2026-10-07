import { describe, expect, it } from 'vitest'

import { memoryDirectory } from '@/adapters/memory/memoryDirectory'
import { memoryFeed } from '@/adapters/memory/memoryFeed'
import { memorySpaces } from '@/adapters/memory/memorySpaces'
import type { FeedItem } from '@/application/feed'
import type { Space } from '@/application/spaces'

const roadmap: Space = {
  id: 'roadmap',
  name: 'Roadmap',
  role: 'admin',
  createdAt: '2026-10-01T08:00:00.000Z',
  color: null,
  description: '',
  apps: ['chat'],
  chat: true,
  mail: true,
  homeserverUrl: 'https://matrix.acme.test',
  members: [
    {
      id: 'u-alice',
      username: 'alice',
      email: 'alice@acme.test',
      displayName: null,
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

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 7, 8, minute)).toISOString()

const message = (minute: number): FeedItem => ({
  id: `m${String(minute)}`,
  kind: 'post',
  category: 'messages',
  time: at(minute),
  updatedAt: at(minute),
  reactions: [],
  author: { type: 'user', id: 'u-bob', name: 'Bob Durand' },
  body: `Message ${String(minute)}`,
  editedAt: null
})

const file: FeedItem = {
  id: 'file',
  kind: 'card',
  category: 'files',
  time: at(50),
  updatedAt: at(50),
  reactions: [],
  type: 'com.twake.drive.file.created.v1',
  actor: { type: 'user', id: 'u-bob', name: 'Bob Durand' },
  object: { type: 'file', id: 'f-1', title: 'brief.pdf', container: null },
  preview: null,
  state: {}
}

describe('memorySpaces', () => {
  it('renames and removes a space', async () => {
    const spaces = memorySpaces([roadmap], { people, groups })

    await spaces.rename('roadmap', 'Roadmap 2027')
    expect(await spaces.list()).toEqual([
      expect.objectContaining({ id: 'roadmap', name: 'Roadmap 2027' })
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
      displayName: 'Bob Durand',
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

    const created = await spaces.create({
      name: 'Launch',
      description: 'Ship it',
      color: '#46a2ff',
      apps: ['tasks']
    })

    expect(await spaces.list()).toEqual([
      {
        id: 'roadmap',
        name: 'Roadmap',
        role: 'admin',
        color: null,
        description: '',
        members: [{ id: 'u-alice', username: 'alice', displayName: null }]
      },
      created
    ])
    expect(await spaces.get(created.id)).toMatchObject({
      name: 'Launch',
      role: 'admin',
      description: 'Ship it',
      color: '#46a2ff',
      apps: ['tasks']
    })
    await expect(spaces.get('nowhere')).rejects.toMatchObject({ status: 404 })
  })
})

describe('memoryFeed', () => {
  const seed = {
    roadmap: [...Array.from({ length: 12 }, (_, i) => message(i + 1)), file]
  }
  const feedFor = (role: 'admin' | 'viewer') =>
    memoryFeed(seed, {
      me: { id: 'u-bob', name: 'Bob Durand' },
      roles: { roadmap: role },
      pageSize: 10
    })

  it('reads the newest page of a category, then the older one', async () => {
    const feed = feedFor('admin')

    const first = await feed.list('roadmap', { category: 'messages' })
    expect(first.items.map(item => item.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `m${String(12 - i)}`)
    )

    const older = await feed.list('roadmap', {
      category: 'messages',
      before: first.next ?? ''
    })
    expect(older).toEqual({ items: [message(2), message(1)], next: null })
  })

  it('reads nothing before an item that is gone', async () => {
    expect(await feedFor('admin').list('roadmap', { before: 'gone' })).toEqual({
      items: [],
      next: null
    })
  })

  it('keeps only the cards of a category', async () => {
    expect(
      await feedFor('admin').list('roadmap', { category: 'files' })
    ).toEqual({ items: [file], next: null })
  })

  it("edits, reacts to and deletes the caller's own post", async () => {
    const feed = feedFor('admin')
    const post = await feed.post('roadmap', 'Hi all')

    await feed.edit('roadmap', post.id, 'Hello all')
    await feed.react('roadmap', post.id, '🎉')

    expect(await feed.item('roadmap', post.id)).toMatchObject({
      body: 'Hello all',
      reactions: [{ key: '🎉', userIds: ['u-bob'] }]
    })

    await feed.unreact('roadmap', post.id, '🎉')
    expect((await feed.item('roadmap', post.id)).reactions).toEqual([])

    await feed.remove('roadmap', post.id)
    await expect(feed.item('roadmap', post.id)).rejects.toMatchObject({
      status: 404
    })
  })

  it('refuses a post from a viewer', async () => {
    await expect(feedFor('viewer').post('roadmap', 'Hi')).rejects.toMatchObject(
      { status: 403, code: 'cannot_post' }
    )
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
