import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/testing/renderWithProviders'
import { NotificationPermissionPrompt } from '@/ui/shell/NotificationPermissionPrompt'

function waitingNotifications() {
  let isWaiting = false
  const listeners = new Set<() => void>()
  return {
    show: vi.fn(),
    close: vi.fn(),
    allow: vi.fn(),
    isWaiting: () => isWaiting,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setWaiting: (value: boolean) => {
      isWaiting = value
      listeners.forEach(listener => {
        listener()
      })
    }
  }
}

describe('NotificationPermissionPrompt', () => {
  it('offers to allow the notifications while one waits', async () => {
    const notifications = waitingNotifications()
    renderWithProviders(<NotificationPermissionPrompt />, { notifications })
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull()

    act(() => {
      notifications.setWaiting(true)
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }))

    expect(notifications.allow).toHaveBeenCalledOnce()
  })

  it('goes away when dismissed', async () => {
    const notifications = waitingNotifications()
    notifications.setWaiting(true)
    renderWithProviders(<NotificationPermissionPrompt />, { notifications })

    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull()
    })
    expect(notifications.allow).not.toHaveBeenCalled()
  })
})
