import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FeedPage } from '@/application/feed'
import { fakeFeed } from '@/testing/fakeFeed'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { FeedPanel } from '@/ui/space/FeedPanel'

const ROOM = '!space:acme.test'

const page: FeedPage = {
  entries: [
    {
      kind: 'message',
      id: '$m',
      ts: 1,
      sender: '@bob:acme.test',
      body: 'Hello'
    },
    {
      kind: 'card',
      id: '$c',
      ts: 2,
      category: 'activities',
      actor: { type: 'user', id: 'u-1', email: 'bob@acme.test' },
      object: {
        type: 'task',
        id: 'T-1',
        title: 'Write the brief',
        url: 'https://tasks.test/T-1'
      },
      preview: 'Due Friday'
    }
  ],
  hasOlder: true
}

function renderFeed(feed = fakeFeed(page)) {
  renderWithProviders(
    <FeedPanel homeserverUrl="https://matrix.acme.test" roomId={ROOM} />,
    {
      feed
    }
  )
  return feed
}

describe('FeedPanel', () => {
  it("shows the Matrix space's messages and cards", async () => {
    const feed = renderFeed()

    expect(await screen.findByText('Hello')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Write the brief' })
    ).toHaveAttribute('href', 'https://tasks.test/T-1')
    expect(screen.getByText('Due Friday')).toBeInTheDocument()
    expect(feed.open).toHaveBeenCalledWith(ROOM, 'all', expect.any(Function))
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

  it('says when the feed is empty', async () => {
    renderFeed(fakeFeed({ entries: [], hasOlder: false }))

    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Load older' })
    ).not.toBeInTheDocument()
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
