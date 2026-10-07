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
  OverlayFrame,
  overlayClipPath,
  parseOverlayRegionMessage,
  type OverlayRegion
} from '@linagora/twake-mui'

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

// The frame of an app in a tab of a space, and what every embedded app gets
// from TwakeSpace:
// - its path below `embed` written in the address (`updateHistory`),
// - a new sign in when its session expired (`notifyLoginRequired`), through
//   cozy-external-bridge (comlink),
// - with `overlayPath`, an overlay over the whole page, on the app's origin,
//   for its docked windows and dialogs: an empty page the app renders into,
//   shown within the region the app reports (`twake-embed:overlay-region`).
export function EmbeddedAppFrame({
  app,
  appUrl,
  embedPath,
  tabPath,
  title,
  overlayPath,
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
      <iframe
        ref={frame}
        name={name}
        title={title}
        src={src}
        sandbox={SANDBOX}
        allow={ALLOW}
        className="u-w-100 u-flex-auto u-bdw-0"
        onLoad={() => {
          // A frame loaded again draws nothing on the overlay yet
          setRegion(null)
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
