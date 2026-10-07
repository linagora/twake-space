import { cleanup, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FeedbackService } from '@/application/feedback'
import type { Space } from '@/application/spaces'
import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderRoute } from '@/testing/renderWithProviders'

function fakeFeedback(): FeedbackService & {
  unmount: ReturnType<typeof vi.fn>
} {
  const unmount = vi.fn()
  return {
    mount: vi.fn(() => unmount),
    setSpaceTab: vi.fn(),
    unmount
  }
}

const space: Space = {
  id: 'a1',
  name: 'Roadmap',
  role: 'editor',
  createdAt: new Date().toISOString(),
  color: null,
  description: '',
  apps: ['chat', 'tasks', 'drive', 'mail', 'calendar'],
  chat: false,
  mail: true,
  homeserverUrl: null,
  members: [],
  groups: [],
  resources: []
}

describe('feedback button', () => {
  it('is mounted by the shell with translated labels, and removed with it', async () => {
    const feedback = fakeFeedback()
    renderRoute('/', { feedback, lang: 'fr' })
    await screen.findByRole('banner')

    // The button is mounted by an effect, which may run after the shell shows.
    await waitFor(() => {
      expect(feedback.mount).toHaveBeenLastCalledWith(
        expect.objectContaining({
          triggerLabel: 'Avis',
          formTitle: 'Donner un avis',
          submitButtonLabel: 'Envoyer'
        }),
        expect.any(String)
      )
    })

    cleanup()
    expect(feedback.unmount).toHaveBeenCalled()
  })

  it('shows nothing without a feedback service', async () => {
    renderRoute('/')

    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(document.getElementById('sentry-feedback')).toBeNull()
  })

  it('tags the open space tab and clears it on leaving', async () => {
    const feedback = fakeFeedback()
    const spaces = fakeSpaces()
    vi.mocked(spaces.get).mockResolvedValue(space)
    const { unmount } = renderRoute('/spaces/a1/members', { feedback, spaces })
    await screen.findByRole('tab', { name: 'Members' })

    await waitFor(() => {
      expect(feedback.setSpaceTab).toHaveBeenCalledWith('members')
    })

    unmount()
    expect(feedback.setSpaceTab).toHaveBeenLastCalledWith(null)
  })
})
