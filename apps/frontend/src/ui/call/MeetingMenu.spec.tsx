import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/testing/renderWithProviders'
import { CallProvider } from '@/ui/call/CallContext'
import { CallWindow } from '@/ui/call/CallWindow'
import { MeetingMenu } from '@/ui/call/MeetingMenu'

function renderMenu(meetUrl: string | null = 'https://meet.test') {
  renderWithProviders(
    <CallProvider>
      <MeetingMenu />
      <CallWindow />
    </CallProvider>,
    { meetUrl }
  )
}

async function join(link: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Video meeting' }))
  fireEvent.click(
    within(screen.getByRole('menu')).getByRole('menuitem', {
      name: 'Join a meeting'
    })
  )
  const dialog = screen.getByRole('dialog', { name: 'Join a meeting' })
  fireEvent.change(within(dialog).getByLabelText('Meeting link'), {
    target: { value: link }
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Join meeting' }))
}

const meeting = () => screen.getByRole('region', { name: 'Video meeting' })

describe('MeetingMenu', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is not shown without Meet', () => {
    renderMenu(null)

    expect(
      screen.queryByRole('button', { name: 'Video meeting' })
    ).not.toBeInTheDocument()
  })

  it('opens a pasted room in the call window', async () => {
    renderMenu()

    await join('https://meet.test/abc-defg-hij')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const frame = within(meeting()).getByTitle('Video meeting')
    expect(frame).toHaveAttribute('src', 'https://meet.test/abc-defg-hij')
    expect(frame).toHaveAttribute(
      'allow',
      'camera; microphone; display-capture; autoplay; fullscreen; clipboard-write'
    )
  })

  it('refuses a link to another site', async () => {
    renderMenu()

    await join('https://evil.test/abc-defg-hij')

    expect(
      screen.getByText('This is not a Twake Meet link or code.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('keeps the room loaded while minimized, and leaves it on close', async () => {
    renderMenu()
    await join('abcdefghij')
    const frame = within(meeting()).getByTitle('Video meeting')

    fireEvent.click(within(meeting()).getByRole('button', { name: 'Minimize' }))
    expect(within(meeting()).getByTitle('Video meeting')).toBe(frame)
    fireEvent.click(within(meeting()).getByRole('button', { name: 'Restore' }))
    fireEvent.click(within(meeting()).getByRole('button', { name: 'Maximize' }))
    expect(within(meeting()).getByTitle('Video meeting')).toBe(frame)

    fireEvent.click(
      within(meeting()).getByRole('button', { name: 'Leave the meeting' })
    )
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
