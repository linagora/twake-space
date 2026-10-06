import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { SessionService } from '@/application/session'
import { fakeSession } from '@/testing/fakeSession'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { MailPanel } from '@/ui/space/MailPanel'

const MAIL = 'https://mail.test'

function Path() {
  const { pathname, search } = useLocation()
  return <output aria-label="path">{pathname + search}</output>
}

function renderAt(
  path: string,
  mailUrl: string | null = `${MAIL}/`,
  session: SessionService = fakeSession()
) {
  renderWithProviders(
    <>
      <Routes>
        <Route
          path="/spaces/:spaceId/mail/*"
          element={<MailPanel spaceId="a1" mailboxId="m/1" />}
        />
      </Routes>
      <Path />
    </>,
    { path, mailUrl, session }
  )
}

function frame(): HTMLIFrameElement {
  const element = screen.getByTitle('Mail')
  if (!(element instanceof HTMLIFrameElement)) throw new Error('no frame')
  return element
}

function postFromFrame(data: unknown, origin = MAIL) {
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

function overlay(): HTMLIFrameElement {
  const element = screen.getByTitle('Mail windows')
  if (!(element instanceof HTMLIFrameElement)) throw new Error('no overlay')
  return element
}

function region(value: unknown) {
  return { type: 'twake-embed:overlay-region', region: value }
}

let calls = 0

// What cozy-external-bridge sends through comlink for `bridge.method(arg)`.
function bridgeCall(method: string, arg?: string, origin = MAIL) {
  calls += 1
  postFromFrame(
    {
      id: String(calls),
      type: 'APPLY',
      path: [method],
      argumentList: arg === undefined ? [] : [{ type: 'RAW', value: arg }]
    },
    origin
  )
}

describe('MailPanel', () => {
  it("frames Mail's embed for the space's team mailbox", async () => {
    renderAt('/spaces/a1/mail')

    const frame = await screen.findByTitle('Mail')
    expect(frame).toHaveAttribute('src', `${MAIL}/embed/team-mailboxes/m%2F1`)
    expect(frame).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads'
    )
  })

  it('opens the mail the URL points at', async () => {
    renderAt('/spaces/a1/mail/thread/t1?q=x')

    expect(await screen.findByTitle('Mail')).toHaveAttribute(
      'src',
      `${MAIL}/embed/team-mailboxes/m%2F1/thread/t1?q=x`
    )
  })

  it("keeps the frame's path in the URL through the bridge", async () => {
    renderAt('/spaces/a1/mail')
    await screen.findByTitle('Mail')

    await waitFor(() => {
      bridgeCall('updateHistory', `${MAIL}/embed/team-mailboxes/m%2F1/t/9?x=1`)
      expect(screen.getByLabelText('path')).toHaveTextContent(
        '/spaces/a1/mail/t/9?x=1'
      )
    })
    expect(frame()).toHaveAttribute('src', `${MAIL}/embed/team-mailboxes/m%2F1`)
  })

  it('ignores a path from another origin or for another mailbox', async () => {
    renderAt('/spaces/a1/mail')
    await screen.findByTitle('Mail')

    bridgeCall(
      'updateHistory',
      `${MAIL}/embed/team-mailboxes/m%2F1/t/9`,
      'https://evil.test'
    )
    bridgeCall('updateHistory', `${MAIL}/embed/team-mailboxes/m%2F12`)
    bridgeCall(
      'updateHistory',
      'https://evil.test/embed/team-mailboxes/m%2F1/t'
    )

    expect(screen.getByLabelText('path')).toHaveTextContent('/spaces/a1/mail')
  })

  it('signs in again when the embed has no SSO session', async () => {
    const session = fakeSession()
    renderAt('/spaces/a1/mail', `${MAIL}/`, session)
    await screen.findByTitle('Mail')

    postFromFrame({ type: 'twake-embed:login-required' }, 'https://evil.test')
    expect(session.signIn).not.toHaveBeenCalled()

    await waitFor(() => {
      postFromFrame({ type: 'twake-embed:login-required' })
      expect(session.signIn).toHaveBeenCalledOnce()
    })
  })

  it('signs in again when the embed asks through the bridge', async () => {
    const session = fakeSession()
    renderAt('/spaces/a1/mail', `${MAIL}/`, session)
    await screen.findByTitle('Mail')

    await waitFor(() => {
      bridgeCall('notifyLoginRequired')
      expect(session.signIn).toHaveBeenCalledOnce()
    })
  })

  it('says so when Mail is not configured', async () => {
    renderAt('/spaces/a1/mail', null)

    expect(
      await screen.findByText('Mail is not set up for TwakeSpace.')
    ).toBeInTheDocument()
  })

  it('names the frame for its overlay', async () => {
    renderAt('/spaces/a1/mail')

    expect(await screen.findByTitle('Mail')).toHaveAttribute(
      'name',
      'twake-embed-mail'
    )
    expect(overlay()).toHaveAttribute('name', 'twake-embed-mail:overlay')
    expect(overlay()).toHaveAttribute('src', `${MAIL}/embed/overlay.html`)
    expect(overlay()).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads'
    )
    expect(frame()).toHaveAttribute('allow', 'clipboard-read; clipboard-write')
    expect(overlay()).toHaveAttribute(
      'allow',
      'clipboard-read; clipboard-write'
    )
  })

  it('takes the page out of reach while Mail blocks it', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    renderAt('/spaces/a1/mail')
    await screen.findByTitle('Mail')

    await waitFor(() => {
      postFromFrame(region('full'))
      expect(root.inert).toBe(true)
    })

    postFromFrame(region([]))
    expect(root.inert).toBe(false)
    root.remove()
  })

  it('shows nothing of the overlay until Mail draws there', async () => {
    renderAt('/spaces/a1/mail')
    await screen.findByTitle('Mail')

    expect(overlay().style.clipPath).toBe('inset(0 0 100% 0)')
    expect(overlay()).toHaveAttribute('aria-hidden', 'true')
    expect(overlay()).toHaveAttribute('tabindex', '-1')
  })

  it('shows the region Mail draws in, then the whole page', async () => {
    renderAt('/spaces/a1/mail')
    await screen.findByTitle('Mail')

    await waitFor(() => {
      postFromFrame(region([{ x: 600, y: 300, width: 400, height: 500 }]))
      expect(overlay().style.clipPath).toBe("path('M600 300h400v500h-400Z')")
    })
    expect(overlay()).not.toHaveAttribute('aria-hidden')

    postFromFrame(region('full'))
    expect(overlay().style.clipPath).toBe('none')

    postFromFrame(region([]))
    expect(overlay().style.clipPath).toBe('inset(0 0 100% 0)')
  })

  it('takes a region only from the Mail frame', async () => {
    renderAt('/spaces/a1/mail')
    await screen.findByTitle('Mail')

    postFromFrame(region('full'), 'https://evil.test')
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: region('full'),
          origin: MAIL,
          source: overlay().contentWindow
        })
      )
    })

    expect(overlay().style.clipPath).toBe('inset(0 0 100% 0)')
  })

  it('shows nothing of the overlay once the Mail frame loads again', async () => {
    renderAt('/spaces/a1/mail')
    await screen.findByTitle('Mail')
    await waitFor(() => {
      postFromFrame(region('full'))
      expect(overlay().style.clipPath).toBe('none')
    })

    fireEvent.load(frame())

    expect(overlay().style.clipPath).toBe('inset(0 0 100% 0)')
  })
})
