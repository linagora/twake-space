import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fakeSession } from '@/testing/fakeSession'
import { renderWithProviders } from '@/testing/renderWithProviders'

function pendingSession() {
  return fakeSession(() => new Promise(() => undefined))
}

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  sessionStorage.clear()
})

describe('SessionGate', () => {
  it('waits for the sign-in before showing the app', async () => {
    let finish: (value: null) => void = () => undefined
    const session = fakeSession(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    renderWithProviders(<p>app</p>, { session })

    expect(
      screen.getByRole('heading', { name: 'Twake Space' })
    ).toBeInTheDocument()
    expect(await screen.findByText('Signing you in…')).toBeInTheDocument()
    await act(async () => {
      finish(null)
      await Promise.resolve()
    })
    expect(screen.queryByText('app')).not.toBeInTheDocument()
  })

  it('says it opens the space the link points at, back from the SSO too', async () => {
    window.history.replaceState(null, '', '/spaces/a1/feed')
    const { unmount } = renderWithProviders(<p>app</p>, {
      session: pendingSession()
    })
    expect(await screen.findByText('Opening your space…')).toBeInTheDocument()
    unmount()

    window.history.replaceState(null, '', '/auth/callback?code=c')
    renderWithProviders(<p>app</p>, { session: pendingSession() })

    expect(await screen.findByText('Opening your space…')).toBeInTheDocument()
  })

  it('tells the user when the sign-in is slow, then offers a way out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const session = pendingSession()
    renderWithProviders(<p>app</p>, { session })
    await screen.findByText('Signing you in…')

    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(
      screen.getByText('Still connecting to your account…')
    ).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(
      screen.getByRole('heading', { name: 'This is taking longer than usual' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign-in' }))
    expect(session.signIn).toHaveBeenCalled()
  })

  it('keeps saying it is slow when the sign-in gives up after the wait', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let giveUp: (error: Error) => void = () => undefined
    const session = fakeSession(
      () =>
        new Promise((_resolve, reject) => {
          giveUp = reject
        })
    )
    renderWithProviders(<p>app</p>, { session })
    await screen.findByText('Signing you in…')

    await act(() => vi.advanceTimersByTimeAsync(8000))
    await act(async () => {
      giveUp(new Error('discovery timed out'))
      await Promise.resolve()
    })

    expect(
      screen.getByRole('heading', { name: 'This is taking longer than usual' })
    ).toBeInTheDocument()
  })

  it('offers to sign in again when the sign-in fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const session = fakeSession(() => Promise.reject(new Error('bad state')))
    renderWithProviders(<p>app</p>, { session })

    expect(
      await screen.findByRole('heading', { name: "We couldn't sign you in" })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign-in' }))

    expect(session.signIn).toHaveBeenCalled()
  })

  it('shows the app once signed in, starting the sign-in once', async () => {
    const session = fakeSession()
    renderWithProviders(<p>app</p>, { session })

    expect(await screen.findByText('app')).toBeInTheDocument()
    expect(session.start).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Twake Space' })
      ).not.toBeInTheDocument()
    })
  })

  it('signs in again when another tab signs out', async () => {
    const session = fakeSession()
    renderWithProviders(<p>app</p>, { session })
    await screen.findByText('app')

    session.endElsewhere()

    expect(session.signIn).toHaveBeenCalled()
  })
})
