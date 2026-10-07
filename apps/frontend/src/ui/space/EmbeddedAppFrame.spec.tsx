import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { EmbedPath } from '@/application/embeddedApps'
import type { SessionService } from '@/application/session'
import { fakeSession } from '@/testing/fakeSession'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { EmbeddedAppFrame } from '@/ui/space/EmbeddedAppFrame'

const MAIL = 'https://mail.test'
const EMBED = '/embed/team-mailboxes/m%2F1'

async function renderFrame(session: SessionService = fakeSession()) {
  const onPath = vi.fn<(report: EmbedPath) => void>()
  renderWithProviders(
    <EmbeddedAppFrame
      app="mail"
      appUrl={`${MAIL}/`}
      embedPath={EMBED}
      src={`${MAIL}${EMBED}`}
      title="Mail"
      overlayPath="/embed/overlay.html"
      active
      frameRef={createRef()}
      onPath={onPath}
    />,
    { session }
  )
  await screen.findByTitle('Mail')
  return onPath
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

describe('EmbeddedAppFrame', () => {
  it('frames the app in a sandbox, named for its overlay', async () => {
    await renderFrame()

    expect(frame()).toHaveAttribute('src', `${MAIL}${EMBED}`)
    expect(frame()).toHaveAttribute('name', 'twake-embed-mail')
    expect(frame()).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads'
    )
    expect(frame()).toHaveAttribute('allow', 'clipboard-read; clipboard-write')
    expect(overlay()).toHaveAttribute('name', 'twake-embed-mail:overlay')
    expect(overlay()).toHaveAttribute('src', `${MAIL}/embed/overlay.html`)
    expect(overlay()).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads'
    )
    expect(overlay()).toHaveAttribute(
      'allow',
      'clipboard-read; clipboard-write'
    )
  })

  it("reports the frame's path, as the app says it", async () => {
    const onPath = await renderFrame()

    await waitFor(() => {
      postFromFrame({
        type: 'twake-embed:path',
        resourceId: 'm/1',
        path: '/t/9?x=1',
        replace: false
      })
      expect(onPath).toHaveBeenCalledWith({
        dialect: 'embed',
        resourceId: 'm/1',
        path: '/t/9?x=1',
        replace: false
      })
    })
  })

  it("reports the frame's path from the bridge, as a replace", async () => {
    const onPath = await renderFrame()

    await waitFor(() => {
      bridgeCall('updateHistory', `${MAIL}${EMBED}/t/9?x=1`)
      expect(onPath).toHaveBeenCalledWith({
        dialect: 'legacy',
        resourceId: null,
        path: '/t/9?x=1',
        replace: true
      })
    })
  })

  it('ignores a path from another origin or another route', async () => {
    const onPath = await renderFrame()
    await waitFor(() => {
      bridgeCall('updateHistory', `${MAIL}${EMBED}`)
      expect(onPath).toHaveBeenCalledOnce()
    })
    onPath.mockClear()

    bridgeCall('updateHistory', `${MAIL}${EMBED}/t/9`, 'https://evil.test')
    bridgeCall('updateHistory', `${MAIL}/embed/team-mailboxes/m%2F12`)
    bridgeCall('updateHistory', `https://evil.test${EMBED}/t`)
    postFromFrame(
      {
        type: 'twake-embed:path',
        resourceId: 'm/1',
        path: '/t',
        replace: true
      },
      'https://evil.test'
    )

    expect(onPath).not.toHaveBeenCalled()
  })

  it('signs in again when the embed has no SSO session', async () => {
    const session = fakeSession()
    await renderFrame(session)

    postFromFrame({ type: 'twake-embed:login-required' }, 'https://evil.test')
    expect(session.signIn).not.toHaveBeenCalled()

    await waitFor(() => {
      postFromFrame({ type: 'twake-embed:login-required' })
      expect(session.signIn).toHaveBeenCalledOnce()
    })
  })

  it('signs in again when the embed asks through the bridge', async () => {
    const session = fakeSession()
    await renderFrame(session)

    await waitFor(() => {
      bridgeCall('notifyLoginRequired')
      expect(session.signIn).toHaveBeenCalledOnce()
    })
  })

  it('greets the frame on each of its loads, with the theme, not before', async () => {
    await renderFrame()
    const contentWindow = frame().contentWindow
    if (!contentWindow) throw new Error('no frame window')
    const post = vi.spyOn(contentWindow, 'postMessage')

    expect(post).not.toHaveBeenCalled()
    fireEvent.load(frame())

    expect(post.mock.calls).toEqual([
      [{ type: 'twake-embed:hello' }, MAIL],
      [{ type: 'twake-space:theme', theme: 'light' }, MAIL]
    ])

    // The silent login loaded another document in the frame
    fireEvent.load(frame())
    expect(post).toHaveBeenCalledTimes(4)
    expect(post.mock.calls[2]).toEqual([{ type: 'twake-embed:hello' }, MAIL])
  })

  it('takes the page out of reach while the app blocks it', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    await renderFrame()

    await waitFor(() => {
      postFromFrame(region('full'))
      expect(root.inert).toBe(true)
    })

    postFromFrame(region([]))
    expect(root.inert).toBe(false)
    root.remove()
  })

  it('shows nothing of the overlay until the app draws there', async () => {
    await renderFrame()

    expect(overlay().style.clipPath).toBe('inset(0 0 100% 0)')
    expect(overlay()).toHaveAttribute('aria-hidden', 'true')
    expect(overlay()).toHaveAttribute('tabindex', '-1')
  })

  it('shows the region the app draws in, then the whole page', async () => {
    await renderFrame()

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

  it("takes a region only from the app's frame", async () => {
    await renderFrame()
    await waitFor(() => {
      bridgeCall('updateHistory', `${MAIL}${EMBED}`)
    })

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

  it('shows nothing of the overlay once the frame loads again', async () => {
    await renderFrame()
    await waitFor(() => {
      postFromFrame(region('full'))
      expect(overlay().style.clipPath).toBe('none')
    })

    fireEvent.load(frame())

    expect(overlay().style.clipPath).toBe('inset(0 0 100% 0)')
  })
})
