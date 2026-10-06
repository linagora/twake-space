import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FeedCard, FeedItem, FeedPost } from '@/application/feed'
import type { Space } from '@/application/spaces'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeLive } from '@/testing/fakeLive'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { useLiveUpdates } from '@/ui/live/useLiveUpdates'
import { FeedPanel } from '@/ui/space/FeedPanel'

const roadmap: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  createdAt: '2026-10-01T08:00:00.000Z',
  color: null,
  description: '',
  apps: ['feed', 'chat', 'tasks', 'mail', 'calendar'],
  chat: true,
  mail: true,
  homeserverUrl: null,
  // I reach this space through a linked group, not as a direct member.
  members: [],
  groups: [{ id: 'g-team', name: 'Team', role: 'editor' }],
  resources: [
    { kind: 'project', id: 'project-1' },
    { kind: 'mailbox', id: 'roadmap@acme' },
    { kind: 'calendar', id: 'cal-1' }
  ]
}

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 7, 8, minute)).toISOString()

const post = (minute: number, overrides: Partial<FeedPost> = {}): FeedPost => ({
  id: `post-${String(minute)}`,
  kind: 'post',
  category: 'messages',
  time: at(minute),
  updatedAt: at(minute),
  reactions: [],
  author: { type: 'user', id: 'u-bob', name: 'Bob Durand' },
  body: `Message ${String(minute)}`,
  editedAt: null,
  ...overrides
})

const task: FeedCard = {
  id: 'task-card',
  kind: 'card',
  category: 'activities',
  time: at(1),
  updatedAt: at(1),
  reactions: [],
  type: 'com.twake.tasks.task.completed.v1',
  actor: { type: 'user', id: 'u-bob', name: 'Bob Durand' },
  object: {
    type: 'task',
    id: 'T-1',
    title: 'Write the brief',
    container: { kind: 'project', id: 'project-1' }
  },
  preview: null,
  state: {}
}

const mail: FeedCard = {
  ...task,
  id: 'mail-card',
  category: 'messages',
  time: at(2),
  type: 'com.twake.mail.message.received.v1',
  actor: null,
  object: {
    type: 'message',
    id: 'm-1',
    title: 'Partner feedback',
    container: { kind: 'mailbox', id: 'roadmap@acme' }
  }
}

const event: FeedCard = {
  ...task,
  id: 'event-card',
  category: 'events',
  time: at(3),
  type: 'com.twake.calendar.event.rescheduled.v1',
  actor: { type: 'user', id: null, name: null },
  object: {
    type: 'event',
    id: 'e-1',
    title: 'Roadmap review',
    container: { kind: 'calendar', id: 'cal-1' }
  },
  state: {
    start: '2026-10-09T09:00:00Z',
    end: '2026-10-09T10:00:00Z',
    allDay: false,
    location: 'Room 4',
    previous: { start: '2026-10-09T08:00:00Z', end: '2026-10-09T09:00:00Z' }
  }
}

function renderFeed(
  items: FeedItem[],
  {
    space = roadmap,
    pageSize,
    live = fakeLive()
  }: {
    space?: Space
    pageSize?: number
    live?: ReturnType<typeof fakeLive>
  } = {}
) {
  const feed = fakeFeed(
    { a1: items },
    { roles: { a1: space.role }, ...(pageSize && { pageSize }) }
  )
  renderWithProviders(<LiveFeed space={space} />, { feed, live })
  return { feed, live }
}

function LiveFeed({ space }: { space: Space }) {
  useLiveUpdates()
  return <FeedPanel space={space} />
}

const articles = () =>
  screen.getAllByRole('article').map(a => a.getAttribute('aria-label'))

describe('FeedPanel', () => {
  it('shows the newest item last, above the composer', async () => {
    renderFeed([post(5), task, post(9)])

    await screen.findByText('Message 9')
    expect(articles()).toEqual([
      'Bob Durand: Write the brief',
      'Bob Durand',
      'Bob Durand'
    ])
    expect(screen.getAllByText(/^Message/).map(m => m.textContent)).toEqual([
      'Message 5',
      'Message 9'
    ])
    expect(screen.getByRole('textbox', { name: 'Text message' })).toBeVisible()
  })

  it('says what each app card is about, and opens its tab', async () => {
    renderFeed([task, mail, event])

    const taskCard = await screen.findByRole('article', {
      name: 'Bob Durand: Write the brief'
    })
    expect(within(taskCard).getByText('completed a task')).toBeInTheDocument()
    expect(
      within(taskCard).getByRole('link', { name: 'Open in Tasks' })
    ).toHaveAttribute('href', '/spaces/a1/tasks')

    const mailCard = screen.getByRole('article', {
      name: 'Mail: Partner feedback'
    })
    expect(within(mailCard).getByText('New email received')).toBeInTheDocument()
    expect(
      within(mailCard).getByRole('link', { name: 'Open in Mail' })
    ).toHaveAttribute('href', '/spaces/a1/mail')

    const eventCard = screen.getByRole('article', {
      name: 'Someone: Roadmap review'
    })
    expect(
      within(eventCard).getByText('rescheduled an event')
    ).toBeInTheDocument()
    expect(within(eventCard).getByText(/Moved from/)).toBeInTheDocument()
    expect(within(eventCard).getByText(/Room 4/)).toBeInTheDocument()
  })

  it('shows one category at a time', async () => {
    const { feed } = renderFeed([post(5), task, event])
    await screen.findByText('Message 5')

    fireEvent.click(screen.getByRole('button', { name: 'Filter by' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Events' }))

    await waitFor(() => {
      expect(articles()).toEqual(['Someone: Roadmap review'])
    })
    expect(feed.list).toHaveBeenLastCalledWith('a1', { category: 'events' })
  })

  it('loads older items on demand', async () => {
    renderFeed(
      Array.from({ length: 3 }, (_, i) => post(i + 1)),
      { pageSize: 2 }
    )
    await screen.findByText('Message 3')
    expect(screen.queryByText('Message 1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Load older' }))

    expect(await screen.findByText('Message 1')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Load older' })
    ).not.toBeInTheDocument()
  })

  it('invites the team to a new space', async () => {
    renderFeed([], { space: { ...roadmap, role: 'admin' } })

    expect(
      await screen.findByRole('heading', { name: 'Set up Roadmap' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Invite members' })
    ).toHaveAttribute('href', '/spaces/a1/members')
  })

  it('says so when a category is empty', async () => {
    renderFeed([post(1)])
    await screen.findByText('Message 1')

    fireEvent.click(screen.getByRole('button', { name: 'Filter by' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Files' }))

    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
  })

  it('posts a message', async () => {
    const { feed } = renderFeed([post(1)])
    const composer = await screen.findByRole('textbox', {
      name: 'Text message'
    })

    fireEvent.change(composer, { target: { value: '  Hello team  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Hello team')).toBeInTheDocument()
    expect(feed.post).toHaveBeenCalledWith('a1', 'Hello team')
    expect(composer).toHaveValue('')
  })

  it('lets a viewer react, but not post', async () => {
    const { feed } = renderFeed([post(1)], {
      space: { ...roadmap, role: 'viewer' }
    })
    await screen.findByText('Message 1')
    expect(
      screen.queryByRole('textbox', { name: 'Text message' })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add a reaction' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '🎉' }))

    expect(
      await screen.findByRole('button', { name: '🎉 1', pressed: true })
    ).toBeInTheDocument()
    expect(feed.react).toHaveBeenCalledWith('a1', 'post-1', '🎉')
  })

  it('takes back a reaction of mine', async () => {
    const { feed } = renderFeed([
      post(1, { reactions: [{ key: '👍', userIds: ['u-bob', 'u-me'] }] })
    ])

    fireEvent.click(
      await screen.findByRole('button', { name: '👍 2', pressed: true })
    )

    expect(
      await screen.findByRole('button', { name: '👍 1', pressed: false })
    ).toBeInTheDocument()
    expect(feed.unreact).toHaveBeenCalledWith('a1', 'post-1', '👍')
  })

  it('edits and deletes my own post only', async () => {
    const mine = post(2, {
      author: { type: 'user', id: 'u-me', name: 'Alice Martin' }
    })
    renderFeed([post(1), mine])
    const article = await screen.findByRole('article', { name: 'Alice Martin' })
    expect(
      within(screen.getByRole('article', { name: 'Bob Durand' })).queryByRole(
        'button',
        { name: 'More actions' }
      )
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(article).getByRole('button', { name: 'More actions' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    fireEvent.change(within(article).getByRole('textbox', { name: 'Edit' }), {
      target: { value: 'Message 2, fixed' }
    })
    fireEvent.click(within(article).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(within(article).queryByRole('textbox')).not.toBeInTheDocument()
    })
    expect(within(article).getByText('Message 2, fixed')).toBeInTheDocument()
    expect(within(article).getByText('edited')).toBeInTheDocument()

    fireEvent.click(
      within(article).getByRole('button', { name: 'More actions' })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.queryByText('Message 2, fixed')).not.toBeInTheDocument()
    })
  })

  it('follows the live changes of this space', async () => {
    const { feed, live } = renderFeed([post(1)])
    await screen.findByText('Message 1')

    vi.mocked(feed.item).mockResolvedValueOnce(post(2))
    act(() => {
      live.emit('feed', { spaceId: 'a1', itemId: 'post-2', change: 'added' })
    })
    expect(await screen.findByText('Message 2')).toBeInTheDocument()

    act(() => {
      live.emit('feed', {
        spaceId: 'other',
        itemId: 'post-1',
        change: 'removed'
      })
      live.emit('feed', { spaceId: 'a1', itemId: 'post-1', change: 'removed' })
    })
    await waitFor(() => {
      expect(screen.queryByText('Message 1')).not.toBeInTheDocument()
    })
  })

  it('leaves out a changed item it has not loaded, and keeps one it cannot reread', async () => {
    const { feed, live } = renderFeed([post(1)])
    await screen.findByText('Message 1')

    vi.mocked(feed.item)
      .mockResolvedValueOnce(post(0))
      .mockRejectedValueOnce(new Error('offline'))
    act(() => {
      live.emit('feed', { spaceId: 'a1', itemId: 'post-0', change: 'changed' })
      live.emit('feed', { spaceId: 'a1', itemId: 'post-1', change: 'changed' })
    })

    await waitFor(() => {
      expect(feed.item).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText('Message 0')).not.toBeInTheDocument()
    expect(screen.getByText('Message 1')).toBeInTheDocument()
  })

  it('shows my own post once when its live echo arrives', async () => {
    const { feed, live } = renderFeed([])
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Text message' }),
      { target: { value: 'Hi' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByText('Hi')

    const [sent] = (await feed.list('a1', {})).items
    act(() => {
      live.emit('feed', { spaceId: 'a1', itemId: sent?.id, change: 'added' })
    })

    await waitFor(() => {
      expect(screen.getAllByText('Hi')).toHaveLength(1)
    })
  })
})
