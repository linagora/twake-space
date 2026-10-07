import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor
} from '@testing-library/react'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { FeedItem } from '@/application/feed'
import type { Space } from '@/application/spaces'
import { fakeFeed } from '@/testing/fakeFeed'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
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
      <Path />
    </>,
    { spaces, path, feed: fakeFeed({ a1: feedItems }) }
  )
  return spaces
}

function Go({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        void navigate(to)
      }}
    >
      Go {to}
    </button>
  )
}

function renderSpaces(path: string, spaces: Space[]) {
  const service = fakeSpaces()
  vi.mocked(service.get).mockImplementation(id => {
    const space = spaces.find(item => item.id === id)
    return space
      ? Promise.resolve(space)
      : Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
  })
  renderWithProviders(
    <>
      <Routes>
        <Route path="/spaces/:spaceId/:tab?/*" element={<SpaceScreen />} />
      </Routes>
      <Path />
      <Go to="/spaces/b2/mail" />
    </>,
    { spaces: service, path }
  )
}

function openTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }))
}

function isHidden(element: HTMLElement): boolean {
  return element.closest('[aria-hidden="true"]') !== null
}

// What cozy-external-bridge sends through comlink for `bridge.method(arg)`.
let bridgeCalls = 0
function bridgeCall(frame: HTMLElement, method: string, arg: string) {
  if (!(frame instanceof HTMLIFrameElement)) throw new Error('no frame')
  bridgeCalls += 1
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          id: `space-${String(bridgeCalls)}`,
          type: 'APPLY',
          path: [method],
          argumentList: [{ type: 'RAW', value: arg }]
        },
        origin: 'https://mail.test',
        source: frame.contentWindow
      })
    )
  })
}

describe('SpaceScreen', () => {
  it("shows the space's name with its actions", async () => {
    renderAt('/spaces/a1/members')

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

  it.each(['tasks', 'mail'])(
    'leaves the %s frame the page under the tabs',
    async tab => {
      renderAt(`/spaces/a1/${tab}`)

      expect(await screen.findByRole('tabpanel')).toContainElement(
        document.querySelector('iframe')
      )
      expect(document.querySelector('main img')).toBeNull()
      expect(
        screen.queryByText('Where the year is planned')
      ).not.toBeInTheDocument()
    }
  )

  it("shows the space's feed on the Feed tab, chat or not", async () => {
    renderAt('/spaces/a1/feed')

    expect(
      await screen.findByRole('tab', { name: 'Feed', selected: true })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('textbox', { name: 'Text message' })
    ).toBeInTheDocument()
  })

  it('keeps the cover over an empty feed, and drops it once the feed has items', async () => {
    renderAt('/spaces/a1/feed')
    await screen.findByRole('heading', { name: 'Set up Roadmap' })
    expect(document.querySelector('main img')).not.toBeNull()

    cleanup()
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
    await screen.findByText('Hello')
    expect(document.querySelector('main img')).toBeNull()
  })

  it("lists the space's people on the Members tab", async () => {
    renderAt('/spaces/a1/members', {
      ...roadmap,
      groups: [{ id: 'g-1', name: 'Designers', role: 'viewer' }]
    })

    expect(
      await screen.findByRole('tab', { name: 'Members', selected: true })
    ).toBeInTheDocument()
    expect(screen.getByText('Designers')).toBeInTheDocument()
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

    openTab('Members')
    expect(
      await screen.findByRole('tab', { name: 'Members', selected: true })
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

  it('opens a frame only once its tab was opened', async () => {
    renderAt('/spaces/a1/members')
    await screen.findByRole('tab', { name: 'Members', selected: true })

    expect(screen.queryByTitle('Mail')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Tasks')).not.toBeInTheDocument()
  })

  it('writes the path of a hidden frame once its tab shows again', async () => {
    renderAt('/spaces/a1/mail')
    const frame = await screen.findByTitle('Mail')
    openTab('Members')
    await screen.findByRole('tab', { name: 'Members', selected: true })

    await waitFor(() => {
      bridgeCall(
        frame,
        'updateHistory',
        'https://mail.test/embed/team-mailboxes/roadmap%40acme/t/9'
      )
      expect(screen.getByLabelText('path')).toHaveTextContent(
        '/spaces/a1/members'
      )
    })
    openTab('Mail')

    await waitFor(() => {
      expect(screen.getByLabelText('path')).toHaveTextContent(
        '/spaces/a1/mail/t/9'
      )
    })
  })

  it('drops the frames of the previous space', async () => {
    const other: Space = {
      ...roadmap,
      id: 'b2',
      name: 'Other',
      resources: roadmap.resources.map(r =>
        r.kind === 'mailbox' ? { ...r, id: 'other@acme' } : r
      )
    }
    renderSpaces('/spaces/a1/mail', [roadmap, other])
    const first = await screen.findByTitle('Mail')

    fireEvent.click(screen.getByRole('button', { name: 'Go /spaces/b2/mail' }))

    await waitFor(() => {
      expect(screen.getByTitle('Mail')).toHaveAttribute(
        'src',
        'https://mail.test/embed/team-mailboxes/other%40acme'
      )
    })
    expect(first).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Mail')).toHaveLength(1)
  })
})
