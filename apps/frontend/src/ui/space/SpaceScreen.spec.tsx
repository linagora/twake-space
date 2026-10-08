import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { FeedItem } from '@/application/feed'
import type { Space } from '@/application/spaces'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { EmbeddedApps } from '@/ui/space/EmbeddedApps'
import { SpaceScreen } from '@/ui/space/SpaceScreen'

const roadmap: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  createdAt: new Date().toISOString(),
  color: null,
  description: 'Where the year is planned',
  apps: ['chat', 'tasks', 'drive', 'mail', 'calendar'],
  chat: false,
  mail: true,
  homeserverUrl: null,
  members: [],
  groups: [],
  resources: [
    { kind: 'matrix_space', id: null },
    { kind: 'project', id: 'project-1' },
    { kind: 'drive', id: null },
    { kind: 'mailbox', id: 'roadmap@acme' },
    { kind: 'calendar', id: 'cal-1' }
  ]
}

function Path() {
  return <output aria-label="path">{useLocation().pathname}</output>
}

function renderAt(
  path: string,
  space: Space | null = roadmap,
  feedItems: FeedItem[] = []
) {
  const spaces = fakeSpaces()
  vi.mocked(spaces.get).mockImplementation(id =>
    space?.id === id
      ? Promise.resolve(space)
      : Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
  )
  renderWithProviders(
    <>
      <Routes>
        <Route path="/spaces/:spaceId/:tab?/*" element={<SpaceScreen />} />
      </Routes>
      <EmbeddedApps />
      <Path />
    </>,
    { spaces, path, feed: fakeFeed({ a1: feedItems }) }
  )
  return spaces
}

function openTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

function isHidden(element: HTMLElement): boolean {
  return element.closest('[aria-hidden="true"]') !== null
}

// What cozy-external-bridge sends through comlink for `bridge.method(arg)`.
describe('SpaceScreen', () => {
  it("shows the space's name with its actions", async () => {
    renderAt('/spaces/a1/feed')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Roadmap' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'More actions for Roadmap' })
    ).toBeInTheDocument()
  })

  it('opens on the feed, which every space has', async () => {
    renderAt('/spaces/a1', { ...roadmap, apps: ['chat', 'tasks'] })

    expect(
      await screen.findByRole('tab', { name: 'Feed', selected: true })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('path')).toHaveTextContent('/spaces/a1/feed')
  })

  it('turns Chat off without chat and says why', async () => {
    renderAt('/spaces/a1/tasks')

    expect(await screen.findByRole('tab', { name: 'Chat' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Feed' })).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'Mail' })).toBeEnabled()
    expect(
      screen.getByText(
        'Chat is off: it is not turned on for your organization.'
      )
    ).toBeInTheDocument()
  })

  it('turns Mail off without a validated mail domain and says why', async () => {
    renderAt('/spaces/a1/tasks', { ...roadmap, chat: true, mail: false })

    expect(await screen.findByRole('tab', { name: 'Mail' })).toBeDisabled()
    expect(
      screen.getByText(
        "Mail is off: your organization's mail domain is not validated yet."
      )
    ).toBeInTheDocument()
  })

  it('leaves a tab that is off for the first tab that is on', async () => {
    renderAt('/spaces/a1/chat')

    expect(
      await screen.findByRole('tab', { name: 'Feed', selected: true })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('path')).toHaveTextContent('/spaces/a1/feed')
  })

  it('keeps the tab in the URL', async () => {
    renderAt('/spaces/a1/tasks')

    fireEvent.click(await screen.findByRole('tab', { name: 'Drive' }))

    expect(
      screen.getByRole('tab', { name: 'Drive', selected: true })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('path')).toHaveTextContent('/spaces/a1/drive')
  })

  it('frames the board a Tasks link points at', async () => {
    renderAt('/spaces/a1/tasks/boards/b1?task=T-1')

    expect(await screen.findByTitle('Tasks')).toHaveAttribute(
      'src',
      'https://tasks.test/embed/projects/project-1/boards/b1?task=T-1'
    )
  })

  it("frames the space's team mailbox on the Mail tab", async () => {
    renderAt('/spaces/a1/mail')

    expect(await screen.findByTitle('Mail')).toHaveAttribute(
      'src',
      'https://mail.test/embed/team-mailboxes/roadmap%40acme'
    )
  })

  it("frames the space's shared drive on the Drive tab, kept alive", async () => {
    renderAt('/spaces/a1/drive', {
      ...roadmap,
      resources: roadmap.resources.map(r =>
        r.kind === 'drive' ? { ...r, id: 'sharing-1' } : r
      )
    })
    const frame = await screen.findByTitle('Drive')
    expect(frame).toHaveAttribute(
      'src',
      'https://alice-drive.twake.test/#/embed/sharings/sharing-1'
    )

    openTab('Feed')
    await screen.findByRole('tab', { name: 'Feed', selected: true })
    expect(screen.getByTitle('Drive')).toBe(frame)
    expect(isHidden(frame)).toBe(true)
  })

  it.each(['tasks', 'mail'])('shows the %s frame alone', async tab => {
    renderAt(`/spaces/a1/${tab}`)

    expect(await screen.findByRole('tabpanel')).toContainElement(
      document.querySelector('iframe')
    )
    expect(
      screen.queryByText('Where the year is planned')
    ).not.toBeInTheDocument()
    expect(document.querySelector('main img')).toBeNull()
  })

  it('keeps the cover folded across tabs once the feed scrolls', async () => {
    renderAt('/spaces/a1/feed', roadmap, [
      {
        id: 'p1',
        kind: 'post',
        category: 'messages',
        time: '2026-10-07T08:00:00.000Z',
        updatedAt: '2026-10-07T08:00:00.000Z',
        reactions: [],
        author: { type: 'user', id: 'u-bob', name: 'Bob' },
        body: 'Hello',
        editedAt: null
      }
    ])
    const list = (await screen.findByText('Hello')).closest('article')
      ?.parentElement?.parentElement
    if (!list) throw new Error('no feed list')
    expect(document.querySelector('main img')).not.toBeNull()

    fireEvent.scroll(list, { target: { scrollTop: -200 } })
    await waitFor(() => {
      expect(document.querySelector('main img')).toBeNull()
    })
    fireEvent.scroll(list, { target: { scrollTop: 0 } })
    expect(document.querySelector('main img')).toBeNull()

    openTab('Tasks')
    await screen.findByRole('tab', { name: 'Tasks', selected: true })
    openTab('Feed')
    await screen.findByText('Hello')
    expect(document.querySelector('main img')).toBeNull()
  })

  it("shows the space's feed on the Feed tab, chat or not", async () => {
    renderAt('/spaces/a1/feed')

    expect(
      await screen.findByRole('tab', { name: 'Feed', selected: true })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('textbox', { name: 'Text message' })
    ).toBeInTheDocument()
  })

  it('shows a resource without an id as being prepared', async () => {
    renderAt('/spaces/a1/drive')

    expect(
      await screen.findByText('Drive is being prepared for this space.')
    ).toBeInTheDocument()
  })

  it('says the app is not ready once it should have been, and checks again', async () => {
    const spaces = renderAt('/spaces/a1/drive', {
      ...roadmap,
      createdAt: '2026-01-01T00:00:00.000Z'
    })

    expect(
      await screen.findByText(
        'Drive is not ready yet. Try again later, and tell your administrator if it stays this way.'
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    await waitFor(() => {
      expect(spaces.get).toHaveBeenCalledTimes(2)
    })
  })

  it('has no tab for an app this deployment does not provide', async () => {
    renderAt('/spaces/a1/tasks', {
      ...roadmap,
      resources: roadmap.resources.filter(r => r.kind !== 'drive')
    })

    expect(await screen.findByRole('tab', { name: 'Tasks' })).toBeVisible()
    expect(screen.queryByRole('tab', { name: 'Drive' })).not.toBeInTheDocument()
  })

  it('says so when the space is not found', async () => {
    renderAt('/spaces/zz', null)

    expect(
      await screen.findByText(
        'This space does not exist, or you are not in it.'
      )
    ).toBeInTheDocument()
  })

  it('keeps the Mail frame alive, hidden, on the other tabs', async () => {
    renderAt('/spaces/a1/mail')
    const frame = await screen.findByTitle('Mail')

    openTab('Feed')
    expect(
      await screen.findByRole('tab', { name: 'Feed', selected: true })
    ).toBeInTheDocument()
    expect(screen.getByTitle('Mail')).toBe(frame)
    expect(isHidden(frame)).toBe(true)

    openTab('Mail')
    await waitFor(() => {
      expect(isHidden(frame)).toBe(false)
    })
    expect(screen.getByTitle('Mail')).toBe(frame)
  })

  it('keeps the Tasks and Mail frames of the space side by side', async () => {
    renderAt('/spaces/a1/tasks')
    const tasks = await screen.findByTitle('Tasks')

    openTab('Mail')
    const mail = await screen.findByTitle('Mail')

    expect(screen.getByTitle('Tasks')).toBe(tasks)
    expect(isHidden(tasks)).toBe(true)
    expect(isHidden(mail)).toBe(false)
  })

  it('mounts the frame of every ready tab up front, hidden', async () => {
    renderAt('/spaces/a1/feed')
    await screen.findByRole('tab', { name: 'Feed', selected: true })

    const mail = await screen.findByTitle('Mail')
    const tasks = await screen.findByTitle('Tasks')
    expect(isHidden(mail)).toBe(true)
    expect(isHidden(tasks)).toBe(true)
    // Chat is off and Drive still preparing: no frame for either
    expect(screen.queryByTitle('Chat')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Drive')).not.toBeInTheDocument()
  })

  describe('counts on the tabs', () => {
    function postBadges(
      title: string,
      origin: string,
      badges: { resourceId: string; count: number }[]
    ) {
      const element = screen.getByTitle(title)
      if (!(element instanceof HTMLIFrameElement)) throw new Error('no frame')
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'twake-embed:badges', badges },
            origin,
            source: element.contentWindow
          })
        )
      })
    }

    async function reportMail(count: number) {
      await screen.findByTitle('Mail')
      await waitFor(() => {
        postBadges('Mail', 'https://mail.test', [
          { resourceId: 'roadmap@acme', count },
          { resourceId: 'other@acme', count: 7 }
        ])
        expect(screen.getByRole('tab', { name: /^Mail/ })).toHaveAccessibleName(
          count > 0 ? `Mail, ${String(count)} new` : 'Mail'
        )
      })
    }

    it("shows the app's count for the space's resource, in the tab's name", async () => {
      renderAt('/spaces/a1/feed')
      await reportMail(3)

      const tab = screen.getByRole('tab', { name: 'Mail, 3 new' })
      expect(tab).toHaveTextContent('Mail3')
      expect(screen.getByRole('tab', { name: 'Tasks' })).toHaveTextContent(
        /^Tasks$/
      )
    })

    it('shows 99+ above 99, and says the count in full', async () => {
      renderAt('/spaces/a1/feed')
      await reportMail(100)

      expect(
        screen.getByRole('tab', { name: 'Mail, 100 new' })
      ).toHaveTextContent('Mail99+')
    })

    it('shows 99 as it is', async () => {
      renderAt('/spaces/a1/feed')
      await reportMail(99)

      expect(
        screen.getByRole('tab', { name: 'Mail, 99 new' })
      ).toHaveTextContent('Mail99')
    })

    it('shows nothing at 0, or without a count for the resource', async () => {
      renderAt('/spaces/a1/feed')
      await reportMail(0)

      expect(screen.getByRole('tab', { name: 'Mail' })).toHaveTextContent(
        /^Mail$/
      )
      expect(screen.getByRole('tab', { name: 'Feed' })).toHaveTextContent(
        /^Feed$/
      )
    })

    it('replaces the previous snapshot, and forgets it when the frame reloads', async () => {
      renderAt('/spaces/a1/feed')
      await reportMail(3)

      postBadges('Mail', 'https://mail.test', [])
      expect(
        await screen.findByRole('tab', { name: 'Mail' })
      ).toBeInTheDocument()

      postBadges('Mail', 'https://mail.test', [
        { resourceId: 'roadmap@acme', count: 4 }
      ])
      expect(
        await screen.findByRole('tab', { name: 'Mail, 4 new' })
      ).toBeInTheDocument()

      fireEvent.load(screen.getByTitle('Mail'))
      expect(
        await screen.findByRole('tab', { name: 'Mail' })
      ).toBeInTheDocument()
    })

    it('ignores counts that do not come from the app', async () => {
      renderAt('/spaces/a1/feed')
      await screen.findByTitle('Mail')

      postBadges('Mail', 'https://evil.test', [
        { resourceId: 'roadmap@acme', count: 3 }
      ])
      // Tasks' frame is not Mail's
      postBadges('Tasks', 'https://mail.test', [
        { resourceId: 'roadmap@acme', count: 3 }
      ])
      await act(() => Promise.resolve())

      expect(screen.getByRole('tab', { name: 'Mail' })).toHaveTextContent(
        /^Mail$/
      )
    })

    it('has no frame, so no count, for a tab that is off', async () => {
      renderAt('/spaces/a1/feed', { ...roadmap, mail: false })
      await screen.findByRole('tab', { name: 'Mail' })

      expect(screen.queryByTitle('Mail')).not.toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Mail' })).toBeDisabled()
    })
  })
})
