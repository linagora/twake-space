import { useColorScheme } from '@linagora/twake-mui'
import { expose } from 'comlink'
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from 'react'

import { parseAppMessage } from '@linagora/twake-embed'
import {
  OverlayFrame,
  overlayClipPath,
  parseOverlayRegionMessage,
  type OverlayRegion
} from '@linagora/twake-mui'

import {
  isLoginRequired,
  legacyEmbedPath,
  parseEmbedPath,
  type EmbedPath
} from '@/application/embeddedApps'
import { EmbedFrame } from '@/ds/EmbedFrame'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'

// Downloads too: a sandboxed frame without it cannot save a file
const SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads'
const ALLOW = 'clipboard-read; clipboard-write'

// The frame of an app, and what every embedded app gets from TwakeSpace:
// - its path reported to the host (`twake-embed:path`, or the legacy
//   `twake-tasks:path` and cozy-external-bridge's `updateHistory`),
// - a new sign in when its session expired (`twake-embed:login-required`,
//   or the bridge's `notifyLoginRequired`),
// - the page's theme (`twake-space:theme`) once it has loaded,
// - an overlay over the whole page, on the app's origin, for its docked
//   windows and dialogs: an empty page the app renders into, shown within
//   the region the app reports (`twake-embed:overlay-region`),
// - with `canFillPage`, the whole page while the app asks for it
//   (`twake-embed:fill-page`): Chat during a call.
// The frame's `src` is set once: the host moves it with messages.
export function EmbeddedAppFrame({
  app,
  appUrl,
  embedPath,
  src,
  title,
  overlayPath,
  allow,
  canFillPage = false,
  active,
  frameRef,
  onPath
}: {
  // Names the frame `twake-embed-<app>`, and its overlay `<that>:overlay`
  app: string
  appUrl: string
  // The embed route the frame was created on, to read legacy paths
  embedPath: string
  src: string
  title: string
  overlayPath: string | null
  // Permissions of this app alone, beyond the clipboard (Chat's calls)
  allow?: string | undefined
  canFillPage?: boolean | undefined
  // Shown, or hidden on another tab: a hidden frame never covers the page
  active: boolean
  frameRef: RefObject<HTMLIFrameElement | null>
  // The frame's URL, already checked to come from it
  onPath: (report: EmbedPath) => void
}): ReactElement {
  const { t } = useI18n()
  const { signIn } = useSession()
  const origin = new URL(appUrl).origin
  const name = `twake-embed-${app}`

  const report = useRef(onPath)
  useEffect(() => {
    report.current = onPath
  })

  const [region, setRegion] = useState<OverlayRegion | null>(null)

  // Never on a hidden tab: the page would stay inert under nothing
  const [asksPage, setAsksPage] = useState(false)
  const fillsPage = canFillPage && asksPage && active
  useEffect(() => {
    const element = frameRef.current
    if (!fillsPage || !element) return
    return inertAround(element)
  }, [fillsPage, frameRef])

  // Until the app loads, the frame holds about:blank on this page's origin
  const [loaded, setLoaded] = useState(false)
  const { mode, systemMode } = useColorScheme()
  const theme = (mode === 'system' ? systemMode : mode) ?? 'light'
  useEffect(() => {
    if (!loaded) return
    frameRef.current?.contentWindow?.postMessage(
      { type: 'twake-space:theme', theme },
      origin
    )
  }, [frameRef, loaded, origin, theme])

  useEffect(() => {
    const target = frameRef.current?.contentWindow
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
        if (reported !== null) {
          setRegion(reported)
          return
        }
        const message = parseAppMessage(event.data)
        if (message?.type === 'twake-embed:fill-page') {
          setAsksPage(message.fill)
          return
        }
        const path = parseEmbedPath(event.data, embedPath)
        if (path !== null) report.current(path)
      },
      { signal: listening.signal }
    )
    // Mail's facade talks through cozy-external-bridge, over comlink.
    expose(
      {
        updateHistory: (url: string) => {
          const next = new URL(url, origin)
          if (next.origin !== origin) return
          const path = legacyEmbedPath(
            next.pathname + next.search + next.hash,
            embedPath
          )
          if (path !== null) report.current(path)
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
  }, [embedPath, frameRef, origin, signIn])

  return (
    <>
      <EmbedFrame
        frameRef={frameRef}
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
          setAsksPage(false)
          setLoaded(true)
        }}
      />
      {overlayPath !== null && (
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
