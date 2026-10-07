import { expose } from 'comlink'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from 'react'

import {
  overlayClipPath,
  parseOverlayRegionMessage,
  type OverlayRegion
} from '@/application/embedOverlay'
import { EmbedFrame } from '@/ds/EmbedFrame'
import { OverlayFrame } from '@/ds/OverlayFrame'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'
import { useEmbedPath } from '@/ui/space/useEmbedPath'

// Downloads too: a sandboxed frame without it cannot save a file
const SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads'
const ALLOW = 'clipboard-read; clipboard-write'

function isLoginRequired(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'twake-embed:login-required'
  )
}

// What `{ type: 'twake-embed:fullscreen', fullscreen }` asks, else null
function fullscreenAsked(data: unknown): boolean | null {
  if (typeof data !== 'object' || data === null) return null
  const { type, fullscreen } = data as Record<string, unknown>
  return type === 'twake-embed:fullscreen' && typeof fullscreen === 'boolean'
    ? fullscreen
    : null
}

// Everything on the page but `element` made inert, until the returned
// function gives it back: the keyboard and screen readers stay in the frame
// while it covers the page
function inertAround(element: HTMLElement): () => void {
  const made: HTMLElement[] = []
  for (
    let node: HTMLElement = element;
    node !== document.body && node.parentElement;
    node = node.parentElement
  ) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (
        sibling !== node &&
        sibling instanceof HTMLElement &&
        !sibling.inert
      ) {
        sibling.inert = true
        made.push(sibling)
      }
    }
  }
  return () => {
    for (const sibling of made) sibling.inert = false
  }
}

// The frame of an app in a tab of a space, and what every embedded app gets
// from TwakeSpace:
// - its path below `embed` written in the address (`updateHistory`),
// - a new sign in when its session expired (`notifyLoginRequired`), through
//   cozy-external-bridge (comlink),
// - with `overlayPath`, an overlay over the whole page, on the app's origin,
//   for its docked windows and dialogs: an empty page the app renders into,
//   shown within the region the app reports (`twake-embed:overlay-region`),
// - with `canFillPage`, the whole page while the app asks for it
//   (`twake-embed:fullscreen`): Chat during a call.
export function EmbeddedAppFrame({
  app,
  appUrl,
  embedPath,
  tabPath,
  title,
  overlayPath,
  allow,
  canFillPage = false,
  active = true,
  frameRef,
  onFrameLoad,
  onFrameMessage
}: {
  // Names the frame `twake-embed-<app>`, and its overlay `<that>:overlay`
  app: string
  appUrl: string
  embedPath: string
  tabPath: string
  title: string
  overlayPath?: string
  // Permissions of this app alone, beyond the clipboard (Chat's calls)
  allow?: string
  canFillPage?: boolean
  // False while another tab of the space shows: the frame stays alive, its
  // overlay too (a composer stays on the page), but it no longer writes the
  // address
  active?: boolean
  frameRef?: RefObject<HTMLIFrameElement | null>
  onFrameLoad?: () => void
  // Other messages of the frame, already checked to come from it, with what
  // writes a path of the frame in the address
  onFrameMessage?: (data: unknown, follow: (path: string) => void) => void
}): ReactElement {
  const { t } = useI18n()
  const { signIn } = useSession()
  const ownRef = useRef<HTMLIFrameElement>(null)
  const frame = frameRef ?? ownRef
  const origin = new URL(appUrl).origin
  const name = `twake-embed-${app}`
  const { src, follow: followAlways } = useEmbedPath(appUrl, embedPath, tabPath)

  // Hidden, the frame's path waits for its tab to show again.
  const isActive = useRef(active)
  const lastPath = useRef<string | null>(null)
  const follow = useCallback(
    (path: string) => {
      lastPath.current = path
      if (isActive.current) followAlways(path)
    },
    [followAlways]
  )
  useEffect(() => {
    isActive.current = active
    if (active && lastPath.current !== null) followAlways(lastPath.current)
  }, [active, followAlways])

  const [region, setRegion] = useState<OverlayRegion | null>(null)
  // Never on a hidden tab: the page would stay inert under nothing
  const [asksFullPage, setAsksFullPage] = useState(false)
  const fillsPage = canFillPage && asksFullPage && active
  useEffect(() => {
    const element = frame.current
    if (!fillsPage || !element) return
    return inertAround(element)
  }, [fillsPage, frame])

  const messageHandler = useRef(onFrameMessage)
  useEffect(() => {
    messageHandler.current = onFrameMessage
  })

  useEffect(() => {
    const target = frame.current?.contentWindow
    if (!target) return
    const listening = new AbortController()
    const fromFrame = (event: Event) =>
      event instanceof MessageEvent &&
      event.origin === origin &&
      event.source === target

    window.addEventListener(
      'message',
      event => {
        if (!fromFrame(event)) return
        if (isLoginRequired(event.data)) {
          void signIn()
          return
        }
        const fullscreen = fullscreenAsked(event.data)
        if (fullscreen !== null) {
          setAsksFullPage(fullscreen)
          return
        }
        const reported = parseOverlayRegionMessage(event.data)
        if (reported !== null) setRegion(reported)
        else messageHandler.current?.(event.data, follow)
      },
      { signal: listening.signal }
    )
    // The embed talks to its host through cozy-external-bridge, over comlink.
    expose(
      {
        updateHistory: (url: string) => {
          const next = new URL(url, origin)
          if (next.origin === origin) {
            follow(next.pathname + next.search + next.hash)
          }
        },
        notifyLoginRequired: signIn
      },
      {
        postMessage: (message: unknown, transfer?: Transferable[]) => {
          target.postMessage(message, origin, transfer)
        },
        addEventListener: (type, listener) => {
          window.addEventListener(
            type,
            event => {
              if (fromFrame(event)) (listener as EventListener)(event)
            },
            { signal: listening.signal }
          )
        },
        removeEventListener: () => undefined
      }
    )
    return () => {
      listening.abort()
    }
  }, [follow, frame, origin, signIn])

  return (
    <>
      <EmbedFrame
        frameRef={frame}
        name={name}
        title={title}
        src={src}
        sandbox={SANDBOX}
        allow={allow === undefined ? ALLOW : `${ALLOW}; ${allow}`}
        fillsPage={fillsPage}
        onLoad={() => {
          // A frame loaded again draws nothing on the overlay yet, and
          // covers nothing
          setRegion(null)
          setAsksFullPage(false)
          onFrameLoad?.()
        }}
      />
      {overlayPath === undefined ? null : (
        <AppOverlay
          name={`${name}:overlay`}
          src={new URL(overlayPath, appUrl).href}
          title={t('embed.overlay', { app: title })}
          region={region}
        />
      )}
    </>
  )
}

// The overlay, shown within the region its app reports.
function AppOverlay({
  name,
  src,
  title,
  region
}: {
  name: string
  src: string
  title: string
  region: OverlayRegion | null
}): ReactElement {
  // While the app blocks the page (a dialog), the rest of it, the app's own
  // frame included, is out of reach of the keyboard and screen readers
  useEffect(() => {
    if (region !== 'full') return
    const page = document.getElementById('root')
    if (!page) return
    page.inert = true
    return () => {
      page.inert = false
    }
  }, [region])

  return (
    <OverlayFrame
      name={name}
      src={src}
      title={title}
      sandbox={SANDBOX}
      allow={ALLOW}
      clipPath={overlayClipPath(region)}
    />
  )
}
