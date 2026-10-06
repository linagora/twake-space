import { Typography } from '@linagora/twake-mui'
import { expose } from 'comlink'
import { useEffect, useRef, type ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useSession } from '@/ui/session/SessionGate'
import { useEmbedPath } from '@/ui/space/useEmbedPath'

function isLoginRequired(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'twake-embed:login-required'
  )
}

export function MailPanel({
  spaceId,
  mailboxId
}: {
  spaceId: string
  mailboxId: string
}): ReactElement {
  const { t } = useI18n()
  const { mailUrl } = useServices()
  if (!mailUrl) return <Typography>{t('mail.notSetUp')}</Typography>
  return <MailFrame spaceId={spaceId} mailboxId={mailboxId} mailUrl={mailUrl} />
}

function MailFrame({
  spaceId,
  mailboxId,
  mailUrl
}: {
  spaceId: string
  mailboxId: string
  mailUrl: string
}): ReactElement {
  const { t } = useI18n()
  const { signIn } = useSession()
  const frame = useRef<HTMLIFrameElement>(null)
  const origin = new URL(mailUrl).origin
  const { src, follow } = useEmbedPath(
    mailUrl,
    `/embed/team-mailboxes/${encodeURIComponent(mailboxId)}`,
    `/spaces/${spaceId}/mail`
  )

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
        if (fromFrame(event) && isLoginRequired(event.data)) void signIn()
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
  }, [follow, origin, signIn])

  return (
    <iframe
      ref={frame}
      title={t('tabs.mail')}
      src={src}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      className="u-w-100 u-flex-auto u-bdw-0"
    />
  )
}
