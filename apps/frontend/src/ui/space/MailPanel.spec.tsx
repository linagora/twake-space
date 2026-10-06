import { act, screen, waitFor } from '@testing-library/react'
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
      'allow-scripts allow-same-origin allow-popups allow-forms'
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
})
