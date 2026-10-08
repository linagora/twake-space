import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Suggestion } from '@/application/suggestions'
import { fakeLive } from '@/testing/fakeLive'
import { fakeHarness, fakeSuggestions } from '@/testing/fakeSuggestions'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { Suggestions } from '@/ui/assistant/Suggestions'
import { useLiveUpdates } from '@/ui/live/useLiveUpdates'

const monday: Suggestion = {
  id: 'n-1',
  text: 'You are free on Monday. Plan the meeting?',
  pendingCallId: 'pc-1'
}

function Overlay() {
  useLiveUpdates()
  return <Suggestions />
}

describe('Suggestions', () => {
  it('shows each suggestion with its text and answers', async () => {
    renderWithProviders(<Suggestions />, {
      suggestions: fakeSuggestions([monday])
    })

    const region = await screen.findByRole('region', {
      name: 'Assistant suggestions'
    })
    expect(region).toHaveTextContent(monday.text)
    for (const name of [
      'Create the meeting',
      'Another time',
      'Not useful',
      'Close'
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('shows nothing without a suggestion', async () => {
    const suggestions = fakeSuggestions()
    renderWithProviders(<Suggestions />, { suggestions })
    await waitFor(() => {
      expect(suggestions.list).toHaveBeenCalled()
    })

    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('approves, then marks it read so that it goes away', async () => {
    const harness = fakeHarness()
    const suggestions = fakeSuggestions([monday])
    renderWithProviders(<Suggestions />, { suggestions, harness })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create the meeting' })
    )

    await waitFor(() => {
      expect(harness.approve).toHaveBeenCalledWith('pc-1')
      expect(suggestions.markRead).toHaveBeenCalledWith('n-1')
    })
    await waitFor(() => {
      expect(screen.queryByText(monday.text)).not.toBeInTheDocument()
    })
  })

  it.each([
    ['Another time', 'another_time'],
    ['Not useful', 'not_useful']
  ])('%s refuses with its reason', async (name, reason) => {
    const harness = fakeHarness()
    const suggestions = fakeSuggestions([monday])
    renderWithProviders(<Suggestions />, { suggestions, harness })

    fireEvent.click(await screen.findByRole('button', { name }))

    await waitFor(() => {
      expect(harness.refuse).toHaveBeenCalledWith('pc-1', reason)
      expect(suggestions.markRead).toHaveBeenCalledWith('n-1')
    })
  })

  it('closes without telling the assistant', async () => {
    const harness = fakeHarness()
    const suggestions = fakeSuggestions([monday])
    renderWithProviders(<Suggestions />, { suggestions, harness })

    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(suggestions.markRead).toHaveBeenCalledWith('n-1')
    })
    expect(harness.approve).not.toHaveBeenCalled()
    expect(harness.refuse).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText(monday.text)).not.toBeInTheDocument()
    })
  })

  it('only closes without a harness', async () => {
    renderWithProviders(<Suggestions />, {
      suggestions: fakeSuggestions([monday]),
      harness: null
    })

    await screen.findByText(monday.text)

    expect(
      screen.queryByRole('button', { name: 'Create the meeting' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('shows an error and keeps the suggestion when the harness fails', async () => {
    const harness = fakeHarness()
    vi.mocked(harness.approve).mockRejectedValue(new Error('down'))
    const suggestions = fakeSuggestions([monday])
    renderWithProviders(<Suggestions />, { suggestions, harness })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create the meeting' })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The assistant could not be reached'
    )
    expect(suggestions.markRead).not.toHaveBeenCalled()
    expect(screen.getByText(monday.text)).toBeInTheDocument()
  })

  it('reads the suggestions again on a notification event', async () => {
    const live = fakeLive()
    const suggestions = fakeSuggestions()
    renderWithProviders(<Overlay />, { suggestions, live })
    await waitFor(() => {
      expect(suggestions.list).toHaveBeenCalledTimes(1)
    })

    suggestions.add(monday)
    act(() => {
      live.emit('notification', {})
    })

    expect(await screen.findByText(monday.text)).toBeInTheDocument()
  })
})
