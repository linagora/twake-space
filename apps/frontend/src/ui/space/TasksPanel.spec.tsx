import { act, fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/testing/renderWithProviders'
import { TasksPanel } from '@/ui/space/TasksPanel'

const TASKS = 'https://tasks.test'

function Path() {
  const { pathname, search } = useLocation()
  return <output aria-label="path">{pathname + search}</output>
}

function renderAt(path: string, tasksUrl: string | null = `${TASKS}/`) {
  renderWithProviders(
    <>
      <Routes>
        <Route
          path="/spaces/:spaceId/tasks/*"
          element={<TasksPanel spaceId="a1" projectId="p1" />}
        />
      </Routes>
      <Path />
    </>,
    { path, tasksUrl }
  )
}

function frame(): HTMLIFrameElement {
  const element = screen.getByTitle('Tasks')
  if (!(element instanceof HTMLIFrameElement)) throw new Error('no frame')
  return element
}

function postFromFrame(data: unknown, origin = TASKS) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin,
        source: frame().contentWindow
      })
    )
  })
}

describe('TasksPanel', () => {
  it("frames Tasks' embed for the space's project", async () => {
    renderAt('/spaces/a1/tasks')

    expect(await screen.findByTitle('Tasks')).toHaveAttribute(
      'src',
      `${TASKS}/embed/projects/p1`
    )
    expect(frame()).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-forms'
    )
  })

  it('opens the board and task the URL points at', async () => {
    renderAt('/spaces/a1/tasks/boards/b1?task=T-1')

    expect(await screen.findByTitle('Tasks')).toHaveAttribute(
      'src',
      `${TASKS}/embed/projects/p1/boards/b1?task=T-1`
    )
  })

  it("keeps the frame's path in the URL without reloading the frame", async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')

    postFromFrame({
      type: 'twake-tasks:path',
      path: '/embed/projects/p1/boards/b2?task=T-9'
    })

    expect(screen.getByLabelText('path')).toHaveTextContent(
      '/spaces/a1/tasks/boards/b2?task=T-9'
    )
    expect(frame()).toHaveAttribute('src', `${TASKS}/embed/projects/p1`)
  })

  it('ignores a path from another origin or for another project', async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')

    postFromFrame(
      { type: 'twake-tasks:path', path: '/embed/projects/p1/boards/b2' },
      'https://evil.test'
    )
    postFromFrame({ type: 'twake-tasks:path', path: '/embed/projects/p12' })

    expect(screen.getByLabelText('path')).toHaveTextContent('/spaces/a1/tasks')
  })

  it('sends the theme to the frame once loaded', async () => {
    renderAt('/spaces/a1/tasks')
    await screen.findByTitle('Tasks')
    const target = frame()
    const contentWindow = target.contentWindow
    if (!contentWindow) throw new Error('no frame window')
    const post = vi.spyOn(contentWindow, 'postMessage')

    fireEvent.load(target)

    expect(post).toHaveBeenCalledWith(
      { type: 'twake-space:theme', theme: 'light' },
      TASKS
    )
  })

  it('says so when Tasks is not configured', async () => {
    renderAt('/spaces/a1/tasks', null)

    expect(
      await screen.findByText('Tasks is not set up for TwakeSpace.')
    ).toBeInTheDocument()
  })
})
