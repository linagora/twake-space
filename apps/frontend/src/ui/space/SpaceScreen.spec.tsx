import { fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { Space } from '@/application/spaces'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { SpaceScreen } from '@/ui/space/SpaceScreen'

const roadmap: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  chat: false,
  mail: true,
  resources: [
    { kind: 'tasks', id: 'board-1' },
    { kind: 'drive', id: null },
    { kind: 'mailbox', id: 'roadmap@acme' },
    { kind: 'calendar', id: 'cal-1' }
  ]
}

function Path() {
  return <output aria-label="path">{useLocation().pathname}</output>
}

function renderAt(path: string, space: Space | null = roadmap) {
  const spaces = fakeSpaces()
  vi.mocked(spaces.get).mockImplementation(id =>
    space?.id === id
      ? Promise.resolve(space)
      : Promise.reject(Object.assign(new Error('not found'), { status: 404 }))
  )
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/spaces/:spaceId/:tab?/*" element={<SpaceScreen />} />
      </Routes>
      <Path />
    </>,
    { spaces, path }
  )
}

describe('SpaceScreen', () => {
  it("shows the space's name and the person's role", async () => {
    renderAt('/spaces/a1/tasks')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Roadmap' })
    ).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('opens on the first tab that is on', async () => {
    renderAt('/spaces/a1')

    expect(
      await screen.findByRole('tab', { name: 'Tasks', selected: true })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('path')).toHaveTextContent('/spaces/a1/tasks')
  })

  it('turns Feed and Chat off without chat and says why', async () => {
    renderAt('/spaces/a1/tasks')

    expect(await screen.findByRole('tab', { name: 'Feed' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Chat' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Mail' })).toBeEnabled()
    expect(
      screen.getByText(
        'Feed and Chat are off: chat is not turned on for your organization.'
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
      await screen.findByRole('tab', { name: 'Tasks', selected: true })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('path')).toHaveTextContent('/spaces/a1/tasks')
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
      'https://tasks.test/embed/spaces/a1/boards/b1?task=T-1'
    )
  })

  it('shows a resource without an id as being prepared', async () => {
    renderAt('/spaces/a1/drive')

    expect(
      await screen.findByText('Drive is being prepared for this space.')
    ).toBeInTheDocument()
  })

  it('says so when the space is not found', async () => {
    renderAt('/spaces/zz', null)

    expect(
      await screen.findByText(
        'This space does not exist, or you are not in it.'
      )
    ).toBeInTheDocument()
  })
})
