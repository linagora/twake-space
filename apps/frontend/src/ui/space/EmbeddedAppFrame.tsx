import { expose } from 'comlink'
import { useEffect, useRef, type ReactElement, type RefObject } from 'react'

import { useSession } from '@/ui/session/SessionGate'
import { useEmbedPath } from '@/ui/space/useEmbedPath'

const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-forms'

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
//   cozy-external-bridge (comlink).
export function EmbeddedAppFrame({
  appUrl,
  embedPath,
  tabPath,
  title,
  frameRef,
  onFrameLoad,
  onFrameMessage
}: {
  appUrl: string
  embedPath: string
  tabPath: string
  title: string
  frameRef?: RefObject<HTMLIFrameElement | null>
  onFrameLoad?: () => void
  // Other messages of the frame, already checked to come from it, with what
  // writes a path of the frame in the address
  onFrameMessage?: (data: unknown, follow: (path: string) => void) => void
}): ReactElement {
  const { signIn } = useSession()
  const ownRef = useRef<HTMLIFrameElement>(null)
  const frame = frameRef ?? ownRef
  const origin = new URL(appUrl).origin
  const { src, follow } = useEmbedPath(appUrl, embedPath, tabPath)

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
        if (isLoginRequired(event.data)) void signIn()
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
    <iframe
      ref={frame}
      title={title}
      src={src}
      sandbox={SANDBOX}
      className="u-w-100 u-flex-auto u-bdw-0"
      onLoad={onFrameLoad}
    />
  )
}
