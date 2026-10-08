import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { Space } from '@/application/spaces'
import { fakeSession, fakeUser } from '@/testing/fakeSession'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderRoute, renderWithProviders } from '@/testing/renderWithProviders'
import { EmbeddedApps } from '@/ui/space/EmbeddedApps'
import { SpaceScreen } from '@/ui/space/SpaceScreen'

const TASKS = 'https://tasks.test'
const MAIL = 'https://mail.test'

const roadmap: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  createdAt: new Date().toISOString(),
  color: null,
  description: 'Where the year is planned',
  apps: ['chat', 'tasks', 'drive', 'mail', 'calendar'],
  chat: true,
  mail: true,
  homeserverUrl: 'https://matrix.acme.test',
  members: [],
  groups: [],
  resources: [
    { kind: 'matrix_space', id: '!s:acme' },
    { kind: 'project', id: 'p1' },
    { kind: 'drive', id: 's/1' },
    { kind: 'mailbox', id: 'roadmap@acme' },
    { kind: 'calendar', id: 'cal-1' }
  ]
}

const other: Space = {
  ...roadmap,
  id: 'b2',
  name: 'Other',
  resources: roadmap.resources.map(r =>
    r.kind === 'project'
      ? { ...r, id: 'p2' }
      : r.kind === 'mailbox'
        ? { ...r, id: 'other@acme' }
        : r
  )
}

function Path() {
  const { pathname, search } = useLocation()
  return <output aria-label="path">{pathname + search}</output>
}

function Go({ to }: { to: string | number }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        void (typeof to === 'number' ? navigate(to) : navigate(to))
      }}
    >
      Go {String(to)}
    </button>
  )
}

function renderAt(
  path: string,
  tasksUrl: string | null = `${TASKS}/`,
  drive: { template: string | null; fqdn: string | null } = {
    template: 'https://{slug}-drive.{domain}/',
    fqdn: 'alice.twake.test'
  }
) {
  const spaces = fakeSpaces()
  vi.mocked(spaces.get).mockImplementation(id => {
    const space = [roadmap, other].find(item => item.id === id)
    return space
      ? Promise.resolve(space)
      : Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
  })
  renderWithProviders(
    <>
      <Routes>
        <Route path="/spaces/:spaceId/:tab?/*" element={<SpaceScreen />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
      <EmbeddedApps />
      <Path />
      <Go to="/spaces/b2/tasks" />
      <Go to="/spaces/a1/tasks" />
      <Go to="/" />
      <Go to={-1} />
    </>,
    {
      path,
      spaces,
      tasksUrl,
      driveUrlTemplate: drive.template,
      session: fakeSession(() =>
        Promise.resolve({ ...fakeUser(), workplaceFqdn: drive.fqdn })
      )
    }
  )
}

function go(to: string | number) {
  fireEvent.click(screen.getByRole('button', { name: `Go ${String(to)}` }))
}

function path(): HTMLElement {
  return screen.getByLabelText('path')
}

function frame(title = 'Tasks'): HTMLIFrameElement {
  const element = screen.getByTitle(title)
  if (!(element instanceof HTMLIFrameElement)) throw new Error('no frame')
  return element
}

function postFromFrame(data: unknown, origin = TASKS, title = 'Tasks') {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin,
        source: frame(title).contentWindow
      })
    )
  })
}

function embedPath(resourceId: string, path: string, replace: boolean) {
  return { type: 'twake-embed:path', resourceId, path, replace }
}

// The frame may not be listened to yet when it first renders.
async function reported(data: unknown, expected: string) {
  await waitFor(() => {
    postFromFrame(data)
    expect(path()).toHaveTextContent(expected)
  })
}

function spyOnFrame(title = 'Tasks') {
  const contentWindow = frame(title).contentWindow
  if (!contentWindow) throw new Error('no frame window')
  return vi.spyOn(contentWindow, 'postMessage')
}

describe('EmbeddedApps', () => {
  it("frames the app's embed for the space's resource, at the URL's path", async () => {
    renderAt('/spaces/a1/tasks/boards/b1?task=T-1')

    expect(await screen.findByTitle('Tasks')).toHaveAttribute(
      'src',
      `${TASKS}/embed/projects/p1/boards/b1?task=T-1`
    )
    expect(screen.getByRole('tabpanel')).toContainElement(frame())
  })

  it('frames the embed route when the path leaves it', async () => {
    renderAt('/spaces/a1/tasks/..%2F..%2Fadmin')

    expect(await screen.findByTitle('Tasks')).toHaveAttribute(
      'src',
      `${TASKS}/embed/projects/p1`
    )
    expect(path()).toHaveTextContent('/spaces/a1/tasks')
  })

  it("writes the frame's path in the URL, pushed when the user moved", async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')

    await reported(
      embedPath('p1', '/boards/b2?task=T-9', false),
      '/spaces/a1/tasks/boards/b2?task=T-9'
    )
    expect(frame()).toHaveAttribute('src', `${TASKS}/embed/projects/p1`)

    go(-1)
    await waitFor(() => {
      expect(path()).toHaveTextContent('/spaces/a1/tasks')
    })
  })

  it("replaces the URL with the frame's path when the app replaced it", async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')

    await reported(
      embedPath('p1', '/boards/b2', true),
      '/spaces/a1/tasks/boards/b2'
    )
    go(-1)

    // Nothing before the space in this history: the URL stays
    await act(() => Promise.resolve())
    expect(path()).toHaveTextContent('/spaces/a1/tasks/boards/b2')
  })

  it("keeps Tasks' legacy path message as a replace", async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')

    await reported(
      { type: 'twake-tasks:path', path: '/embed/projects/p1/boards/b2' },
      '/spaces/a1/tasks/boards/b2'
    )
    postFromFrame({ type: 'twake-tasks:path', path: '/embed/projects/p12' })
    expect(path()).toHaveTextContent('/spaces/a1/tasks/boards/b2')
  })

  it('moves the frame on Back, within the resource', async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')
    await reported(
      embedPath('p1', '/boards/b1', false),
      '/spaces/a1/tasks/boards/b1'
    )
    await reported(
      embedPath('p1', '/boards/b2', false),
      '/spaces/a1/tasks/boards/b2'
    )
    const post = spyOnFrame()

    go(-1)
    await waitFor(() => {
      expect(path()).toHaveTextContent('/spaces/a1/tasks/boards/b1')
    })
    expect(post).toHaveBeenCalledWith(
      { type: 'twake-embed:navigate', resourceId: 'p1', path: '/boards/b1' },
      TASKS
    )

    go(-1)
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        { type: 'twake-embed:navigate', resourceId: 'p1', path: '' },
        TASKS
      )
    })
  })

  it('keeps the frame across spaces and loads the other resource in it', async () => {
    renderAt('/spaces/a1/tasks')
    const first = await screen.findByTitle('Tasks')
    await reported(
      embedPath('p1', '/boards/b1', false),
      '/spaces/a1/tasks/boards/b1'
    )
    const post = spyOnFrame()

    go('/spaces/b2/tasks')
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        { type: 'twake-embed:load', resourceId: 'p2', path: '' },
        TASKS
      )
    })
    expect(screen.getByTitle('Tasks')).toBe(first)
    expect(first).toHaveAttribute('src', `${TASKS}/embed/projects/p1`)
    expect(screen.getAllByTitle('Tasks')).toHaveLength(1)

    go(-1)
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        { type: 'twake-embed:load', resourceId: 'p1', path: '/boards/b1' },
        TASKS
      )
    })
    expect(screen.getByTitle('Tasks')).toBe(first)
  })

  it('replaces the frame of an app that cannot load another resource', async () => {
    renderAt('/spaces/a1/tasks')
    const first = await screen.findByTitle('Tasks')
    await reported(
      { type: 'twake-tasks:path', path: '/embed/projects/p1/boards/b1' },
      '/spaces/a1/tasks/boards/b1'
    )

    go('/spaces/b2/tasks')
    await waitFor(() => {
      expect(screen.getByTitle('Tasks')).toHaveAttribute(
        'src',
        `${TASKS}/embed/projects/p2`
      )
    })
    expect(first).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Tasks')).toHaveLength(1)
  })

  it('replaces a frame that never spoke for another resource', async () => {
    renderAt('/spaces/a1/tasks')
    const first = await screen.findByTitle('Tasks')

    go('/spaces/b2/tasks')
    await waitFor(() => {
      expect(screen.getByTitle('Tasks')).toHaveAttribute(
        'src',
        `${TASKS}/embed/projects/p2`
      )
    })
    expect(first).not.toBeInTheDocument()
  })

  it('loads the resource again in a frame that reports another one', async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')
    await reported(embedPath('p1', '', true), '/spaces/a1/tasks')
    const post = spyOnFrame()
    go('/spaces/b2/tasks')
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        { type: 'twake-embed:load', resourceId: 'p2', path: '' },
        TASKS
      )
    })
    post.mockClear()

    // A late message of the previous resource
    postFromFrame(embedPath('p1', '/boards/b1', false))

    expect(path()).toHaveTextContent('/spaces/b2/tasks')
    expect(post).toHaveBeenCalledWith(
      { type: 'twake-embed:load', resourceId: 'p2', path: '' },
      TASKS
    )
  })

  it('keeps the frame, hidden, off the space and brings it back', async () => {
    renderAt('/spaces/a1/tasks')
    const first = await screen.findByTitle('Tasks')
    await reported(
      embedPath('p1', '/boards/b1', false),
      '/spaces/a1/tasks/boards/b1'
    )

    go('/')
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(screen.getByTitle('Tasks')).toBe(first)
    expect(first.closest('[aria-hidden="true"]')).not.toBeNull()

    go('/spaces/a1/tasks')
    await waitFor(() => {
      expect(path()).toHaveTextContent('/spaces/a1/tasks/boards/b1')
    })
    expect(screen.getByTitle('Tasks')).toBe(first)
    expect(first.closest('[aria-hidden="true"]')).toBeNull()
  })

  it('writes the path of a hidden frame once its tab shows again', async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')
    fireEvent.click(screen.getByRole('tab', { name: 'Feed' }))
    await screen.findByRole('tab', { name: 'Feed', selected: true })

    await waitFor(() => {
      postFromFrame(embedPath('p1', '/boards/b9', false))
      expect(path()).toHaveTextContent('/spaces/a1/feed')
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Tasks' }))

    await waitFor(() => {
      expect(path()).toHaveTextContent('/spaces/a1/tasks/boards/b9')
    })
  })

  // The shell's data router applies the address in a transition: the frame
  // must not be brought to the old address in between.
  it("writes the frame's path under the shell without moving the frame", async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.get).mockResolvedValue(roadmap)
    const { router } = renderRoute('/spaces/a1/tasks', { spaces })
    await screen.findByTitle('Tasks')
    const post = spyOnFrame()

    await waitFor(() => {
      postFromFrame(embedPath('p1', '/boards/b2', false))
      expect(router.state.location.pathname).toBe('/spaces/a1/tasks/boards/b2')
    })
    await act(() => Promise.resolve())
    expect(post).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'twake-embed:navigate' }),
      expect.anything()
    )

    await act(() => router.navigate(-1))
    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        { type: 'twake-embed:navigate', resourceId: 'p1', path: '' },
        TASKS
      )
    })
  })

  it("frames the space's Matrix space in Chat, with its calls' permissions", async () => {
    renderAt('/spaces/a1/chat')

    const frame = await screen.findByTitle('Chat')
    expect(frame).toHaveAttribute(
      'src',
      'https://chat.test/embed/rooms/!s%3Aacme'
    )
    expect(frame).toHaveAttribute(
      'allow',
      'clipboard-read; clipboard-write; fullscreen; camera; microphone; display-capture'
    )
    expect(screen.getByTitle('Chat windows')).toHaveAttribute(
      'src',
      'https://chat.test/embed/overlay.html'
    )
  })

  it('lets Chat cover the page while it asks for it, shown and from its frame only', async () => {
    renderAt('/spaces/a1/chat')
    await screen.findByTitle('Chat')
    const chat = frame('Chat')
    const fillPage = (fill: boolean) => ({
      type: 'twake-embed:fill-page',
      fill
    })
    const post = (data: unknown, origin = 'https://chat.test') => {
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data,
            origin,
            source: chat.contentWindow
          })
        )
      })
    }

    await waitFor(() => {
      post(fillPage(true))
      expect(getComputedStyle(chat).position).toBe('fixed')
    })
    // The rest of the page is out of reach, the frame alone is not
    expect(screen.getByRole('button', { name: 'Go /' }).inert).toBe(true)
    expect(chat.closest('[aria-hidden]')).toBeNull()

    post(fillPage(false))
    expect(getComputedStyle(chat).position).not.toBe('fixed')
    expect(screen.getByRole('button', { name: 'Go /' }).inert).toBe(false)

    post(fillPage(true), 'https://evil.test')
    expect(getComputedStyle(chat).position).not.toBe('fixed')

    post(fillPage(true))
    fireEvent.click(screen.getByRole('tab', { name: 'Feed' }))
    await screen.findByRole('tab', { name: 'Feed', selected: true })
    expect(getComputedStyle(chat).position).not.toBe('fixed')

    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    await waitFor(() => {
      expect(getComputedStyle(chat).position).toBe('fixed')
    })
    fireEvent.load(chat)
    expect(getComputedStyle(chat).position).not.toBe('fixed')
  })

  it('does not let Tasks cover the page', async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')

    postFromFrame({ type: 'twake-embed:fill-page', fill: true })
    await act(() => Promise.resolve())

    expect(getComputedStyle(frame()).position).not.toBe('fixed')
  })

  it("frames the space's team calendar with its overlay", async () => {
    renderAt('/spaces/a1/calendar')

    expect(await screen.findByTitle('Calendar')).toHaveAttribute(
      'src',
      'https://calendar.test/embed/calendars/cal-1'
    )
    expect(screen.getByTitle('Calendar windows')).toHaveAttribute(
      'src',
      'https://calendar.test/embed/overlay.html'
    )
  })

  it("frames the space's shared drive on the person's own Twake Drive, without an overlay", async () => {
    renderAt('/spaces/a1/drive/folder/f1')

    expect(await screen.findByTitle('Drive')).toHaveAttribute(
      'src',
      'https://alice-drive.twake.test/#/embed/sharings/s%2F1/folder/f1'
    )
    expect(screen.queryByTitle('Drive windows')).not.toBeInTheDocument()
  })

  it.each([
    ['without a Drive address', null, 'alice.twake.test'],
    [
      "without the person's Twake Workplace",
      'https://{slug}-drive.{domain}/',
      null
    ]
  ])('says Drive is not set up %s', async (_case, template, fqdn) => {
    renderAt('/spaces/a1/drive', `${TASKS}/`, { template, fqdn })

    expect(
      await screen.findByText('Drive is not set up for TwakeSpace.')
    ).toBeVisible()
    expect(screen.queryByTitle('Drive')).not.toBeInTheDocument()
  })

  it('says so when the app is not configured, and frames nothing', async () => {
    renderAt('/spaces/a1/tasks', null)

    expect(
      await screen.findByText('Tasks is not set up for TwakeSpace.')
    ).toBeInTheDocument()
    expect(screen.queryByTitle('Tasks')).not.toBeInTheDocument()
  })

  describe('with every ready frame mounted up front', () => {
    it("mounts a frame for each app of the space that is ready, only the tab's shown", async () => {
      renderAt('/spaces/a1/tasks')
      await screen.findByTitle('Tasks')

      const isHidden = (title: string) =>
        frame(title).closest('[aria-hidden="true"]') !== null
      expect(isHidden('Tasks')).toBe(false)
      for (const title of ['Chat', 'Drive', 'Mail']) {
        expect(isHidden(title)).toBe(true)
      }
      expect(frame('Mail')).toHaveAttribute(
        'src',
        `${MAIL}/embed/team-mailboxes/roadmap%40acme`
      )
      expect(frame('Chat')).toHaveAttribute(
        'src',
        'https://chat.test/embed/rooms/!s%3Aacme'
      )
    })

    it('mounts no frame for an app that is not set up', async () => {
      renderAt('/spaces/a1/mail', null, { template: null, fqdn: null })
      await screen.findByTitle('Mail')

      expect(screen.queryByTitle('Tasks')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Drive')).not.toBeInTheDocument()
      expect(screen.getByTitle('Chat')).toBeInTheDocument()
    })

    it('mounts the frames on a tab of the space that has none', async () => {
      renderAt('/spaces/a1/feed')

      expect(await screen.findByTitle('Mail')).toBeInTheDocument()
      expect(screen.getByTitle('Tasks')).toBeInTheDocument()
    })

    it('moves the hidden frames to the new space, without touching the history', async () => {
      renderAt('/spaces/a1/tasks')
      const mail = await screen.findByTitle('Mail')
      postFromFrame(embedPath('roadmap@acme', '', true), MAIL, 'Mail')
      const post = spyOnFrame('Mail')

      go('/spaces/b2/tasks')
      await waitFor(() => {
        expect(post).toHaveBeenCalledWith(
          { type: 'twake-embed:load', resourceId: 'other@acme', path: '' },
          MAIL
        )
      })
      expect(screen.getByTitle('Mail')).toBe(mail)
      expect(post).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'twake-embed:navigate' }),
        MAIL
      )
      expect(path()).toHaveTextContent('/spaces/b2/tasks')

      // The hidden frame's load took no entry: one Back is the first space
      go(-1)
      await waitFor(() => {
        expect(path()).toHaveTextContent('/spaces/a1/tasks')
      })
      await waitFor(() => {
        expect(post).toHaveBeenCalledWith(
          { type: 'twake-embed:load', resourceId: 'roadmap@acme', path: '' },
          MAIL
        )
      })
    })

    it('replaces the hidden frame of an app that cannot load another resource', async () => {
      renderAt('/spaces/a1/tasks')
      const mail = await screen.findByTitle('Mail')

      go('/spaces/b2/tasks')
      await waitFor(() => {
        expect(screen.getByTitle('Mail')).toHaveAttribute(
          'src',
          `${MAIL}/embed/team-mailboxes/other%40acme`
        )
      })
      expect(mail).not.toBeInTheDocument()
      expect(screen.getAllByTitle('Mail')).toHaveLength(1)
    })

    it('moves the hidden frames when the space changes from a tab with no frame', async () => {
      renderAt('/spaces/a1/feed')
      await screen.findByTitle('Mail')
      postFromFrame(embedPath('roadmap@acme', '', true), MAIL, 'Mail')
      const post = spyOnFrame('Mail')

      go('/spaces/b2/tasks')
      await waitFor(() => {
        expect(post).toHaveBeenCalledWith(
          { type: 'twake-embed:load', resourceId: 'other@acme', path: '' },
          MAIL
        )
      })
    })

    it('never writes the address for a hidden frame, and keeps its path for later', async () => {
      renderAt('/spaces/a1/tasks')
      await screen.findByTitle('Mail')

      postFromFrame(embedPath('roadmap@acme', '/inbox', false), MAIL, 'Mail')
      await act(() => Promise.resolve())
      expect(path()).toHaveTextContent('/spaces/a1/tasks')
      go(-1)
      await act(() => Promise.resolve())
      // Nothing was pushed: the only entry is still the first
      expect(path()).toHaveTextContent('/spaces/a1/tasks')
    })
  })
})
