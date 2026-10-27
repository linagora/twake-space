import type { Metadata } from '@linagora/twake-embed'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Space, SpaceSummary } from '@/application/spaces'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { useBadgeActions } from '@/ui/space/Badges'
import { ChatFavourites } from '@/ui/space/ChatFavourites'

const summary: SpaceSummary = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  color: null,
  description: '',
  members: [],
  pinnedAt: null,
  openedAt: null,
  manages: false
}

const detail: Space = {
  ...summary,
  members: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  apps: ['chat'],
  chat: true,
  mail: false,
  homeserverUrl: 'https://matrix.acme.test',
  chatUrl: null,
  banner: null,
  groups: [],
  resources: [{ kind: 'matrix_space', id: '!s:acme' }]
}

const favourite = (value: number): Metadata[] => [
  { resourceId: '!s:acme', name: 'favourite', value }
]

function Chat(): ReactElement {
  const { metadata } = useBadgeActions()
  return (
    <>
      <button
        onClick={() => {
          metadata('chat', favourite(1))
        }}
      >
        favourite
      </button>
      <button
        onClick={() => {
          metadata('chat', favourite(0))
        }}
      >
        not
      </button>
    </>
  )
}

function setup(space: SpaceSummary = summary) {
  const spaces = fakeSpaces([space])
  spaces.get = vi.fn(() =>
    Promise.resolve({ ...detail, pinnedAt: space.pinnedAt })
  )
  renderWithProviders(
    <>
      <Chat />
      <ChatFavourites />
    </>,
    { spaces }
  )
  return spaces
}

const report = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name }))
}

describe('ChatFavourites', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('pins the space of a Matrix space Chat marks as favourite', async () => {
    const spaces = setup()

    await report('favourite')

    await waitFor(() => {
      expect(spaces.setPinned).toHaveBeenCalledWith('a1', true)
    })
  })

  it('unpins it when Chat clears the favourite', async () => {
    const spaces = setup({ ...summary, pinnedAt: '2026-10-01T00:00:00Z' })
    localStorage.setItem(
      'twake-space:chat-favourites:u-me',
      JSON.stringify({ '!s:acme': 1 })
    )

    await report('not')

    await waitFor(() => {
      expect(spaces.setPinned).toHaveBeenCalledWith('a1', false)
    })
  })

  it('keeps a failed pin unseen, to try it again', async () => {
    const spaces = setup()
    vi.mocked(spaces.setPinned).mockRejectedValueOnce(new Error('offline'))

    await report('favourite')

    await waitFor(() => {
      expect(spaces.setPinned).toHaveBeenCalledWith('a1', true)
    })
    expect(localStorage.getItem('twake-space:chat-favourites:u-me')).toBe(
      JSON.stringify({})
    )
  })

  it('leaves a pin set in Twake Space while Chat does not change', async () => {
    const spaces = setup({ ...summary, pinnedAt: '2026-10-01T00:00:00Z' })

    await report('not')

    await waitFor(() => {
      expect(localStorage.getItem('twake-space:chat-favourites:u-me')).toBe(
        JSON.stringify({ '!s:acme': 0 })
      )
    })
    expect(spaces.setPinned).not.toHaveBeenCalled()
  })
})
