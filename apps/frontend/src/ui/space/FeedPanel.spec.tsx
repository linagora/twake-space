import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Actor, FeedEntry, FeedObject, FeedPage } from '@/application/feed'
import type { Space } from '@/application/spaces'
import { fakeFeed } from '@/testing/fakeFeed'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { FeedPanel } from '@/ui/space/FeedPanel'

const ROOM = '!space:acme.test'

const space: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  createdAt: '2026-10-01T08:00:00.000Z',
  color: null,
  description: '',
  apps: ['feed', 'chat'],
  chat: true,
  mail: false,
  homeserverUrl: 'https://matrix.acme.test',
  members: [
    {
      id: 'u-1',
      username: 'bob',
      email: 'bob@acme.test',
      displayName: null,
      role: 'editor'
    }
  ],
  groups: [],
  resources: [
    { kind: 'matrix_space', id: ROOM },
    { kind: 'project', id: 'p1' }
  ]
}

function card(
  id: string,
  actor: Actor | null,
  object: { title: string; container?: FeedObject['container'] },
  app: string | null = 'drive'
): FeedEntry {
  return {
    kind: 'card',
    id,
    ts: 2,
    category: 'files',
    app,
    actor,
    object: { type: 'file', id, container: null, ...object },
    preview: null
  }
}

const page: FeedPage = {
  entries: [
    {
      kind: 'message',
      id: '$m',
      ts: 1,
      sender: '@bob:acme.test',
      senderName: 'Bob Martin',
      body: 'Hello'
    },
    {
      kind: 'card',
      id: '$c',
      ts: 2,
      category: 'activities',
      app: 'tasks',
      actor: { type: 'user', id: 'u-1', email: 'bob@acme.test' },
      object: {
        type: 'task',
        id: 'T-1',
        title: 'Write the brief',
        container: { kind: 'project', id: 'p1' }
      },
      preview: 'Due Friday'
    }
  ],
  hasOlder: true
}

function renderFeed(feed = fakeFeed(page), on = space) {
  renderWithProviders(
    <FeedPanel
      homeserverUrl="https://matrix.acme.test"
      roomId={ROOM}
      space={on}
    />,
    { feed }
  )
  return feed
}

describe('FeedPanel', () => {
  it("shows the Matrix space's messages and cards", async () => {
    const feed = renderFeed()

    expect(await screen.findByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Bob Martin')).toBeInTheDocument()
    expect(screen.getByText('bob · Due Friday')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Tasks' })).toBeInTheDocument()
    expect(feed.open).toHaveBeenCalledWith(ROOM, 'all', expect.any(Function))
  })

  it("opens a card in the space's tab of its container", async () => {
    renderFeed(
      fakeFeed({
        entries: [
          card('$t', null, {
            title: 'Write the brief',
            container: { kind: 'project', id: 'p1' }
          }),
          card('$c', null, {
            title: 'Standup',
            container: { kind: 'matrix_space', id: ROOM }
          })
        ],
        hasOlder: false
      }),
      { ...space, apps: ['feed', 'chat', 'tasks'] }
    )

    expect(
      await screen.findByRole('link', { name: 'Write the brief' })
    ).toHaveAttribute('href', '/spaces/a1/tasks')
    expect(screen.getByRole('link', { name: 'Standup' })).toHaveAttribute(
      'href',
      '/spaces/a1/chat'
    )
  })

  it('links no card whose container has no tab in the space', async () => {
    renderFeed(
      fakeFeed({
        entries: [
          card('$f', null, {
            title: 'brief.pdf',
            container: { kind: 'drive', id: 'd1' }
          }),
          card('$n', null, { title: 'notes.txt' })
        ],
        hasOlder: false
      })
    )

    expect(await screen.findByText('brief.pdf')).toBeInTheDocument()
    expect(screen.getByText('notes.txt')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Drive' })).toHaveLength(2)
  })

  it('names who acted on a card', async () => {
    const file = { title: 'brief.pdf' }
    renderFeed(
      fakeFeed({
        entries: [
          card('$1', { type: 'user', id: 'u-1', email: null }, file),
          card('$2', { type: 'user', id: null, email: 'eve@acme.test' }, file),
          card('$3', { type: 'token', id: 't-1', name: 'CI bot' }, file),
          card('$4', { type: 'deleted_user' }, file)
        ],
        hasOlder: false
      })
    )

    expect(await screen.findByText('bob')).toBeInTheDocument()
    expect(screen.getByText('eve@acme.test')).toBeInTheDocument()
    expect(screen.getByText('CI bot')).toBeInTheDocument()
    expect(screen.getByText('Deleted user')).toBeInTheDocument()
  })

  it('reopens the feed on another filter and closes the previous one', async () => {
    const feed = renderFeed()

    fireEvent.click(await screen.findByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(feed.open).toHaveBeenLastCalledWith(
        ROOM,
        'files',
        expect.any(Function)
      )
    })
    expect(feed.view.close).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('loads older entries on request', async () => {
    const feed = renderFeed()

    fireEvent.click(await screen.findByRole('button', { name: 'Load older' }))

    expect(feed.view.loadOlder).toHaveBeenCalled()
  })

  it('says so when older entries cannot be loaded', async () => {
    const feed = fakeFeed(page)
    vi.mocked(feed.view.loadOlder).mockRejectedValue(new Error('offline'))
    renderFeed(feed)

    fireEvent.click(await screen.findByRole('button', { name: 'Load older' }))

    expect(
      await screen.findByText('Could not load older entries.')
    ).toBeInTheDocument()
  })

  it('offers to set up an empty space with what is ready in it', async () => {
    renderWithProviders(
      <FeedPanel
        homeserverUrl="https://matrix.acme.test"
        roomId={ROOM}
        space={{ ...space, role: 'admin', apps: ['feed', 'chat', 'tasks'] }}
      />,
      { feed: fakeFeed({ entries: [], hasOlder: false }) }
    )

    expect(
      await screen.findByRole('heading', { name: 'Set up Roadmap' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Invite members' })
    ).toHaveAttribute('href', '/spaces/a1/members')
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/spaces/a1/tasks'
    )
    expect(
      screen.queryByRole('button', { name: 'Load older' })
    ).not.toBeInTheDocument()
  })

  it('leaves inviting to the admins and tasks to spaces that have them', async () => {
    renderFeed(fakeFeed({ entries: [], hasOlder: false }))

    expect(
      await screen.findByRole('heading', { name: 'Set up Roadmap' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('says when a filter shows nothing', async () => {
    renderFeed(fakeFeed({ entries: [], hasOlder: false }))

    fireEvent.click(await screen.findByRole('button', { name: 'Files' }))

    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('says so when the feed cannot be loaded', async () => {
    const feed = fakeFeed()
    vi.mocked(feed.open).mockRejectedValue(new Error('not in the space'))

    renderFeed(feed)

    expect(
      await screen.findByText('Could not load the feed.')
    ).toBeInTheDocument()
  })
})
