import { Typography, useColorScheme } from '@linagora/twake-mui'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

function framedPath(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const { type, path } = data as Record<string, unknown>
  return type === 'twake-tasks:path' && typeof path === 'string' ? path : null
}

export function TasksPanel({ spaceId }: { spaceId: string }): ReactElement {
  const { t } = useI18n()
  const { tasksUrl } = useServices()
  if (!tasksUrl) return <Typography>{t('tasks.notSetUp')}</Typography>
  return <TasksFrame spaceId={spaceId} tasksUrl={tasksUrl} />
}

function TasksFrame({
  spaceId,
  tasksUrl
}: {
  spaceId: string
  tasksUrl: string
}): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { '*': rest = '' } = useParams()
  const { search } = useLocation()
  const { mode, systemMode } = useColorScheme()
  const theme = (mode === 'system' ? systemMode : mode) ?? 'light'
  const frame = useRef<HTMLIFrameElement>(null)
  const embed = `/embed/spaces/${spaceId}`
  const origin = new URL(tasksUrl).origin
  // Set once: the frame navigates by itself, and a new src would reload it.
  const [src] = useState(
    () => new URL(`${embed}${rest ? `/${rest}` : ''}${search}`, tasksUrl).href
  )

  const sendTheme = () => {
    frame.current?.contentWindow?.postMessage(
      { type: 'twake-space:theme', theme },
      origin
    )
  }
  useEffect(sendTheme)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== origin ||
        event.source !== frame.current?.contentWindow
      ) {
        return
      }
      const path = framedPath(event.data)
      if (!path?.startsWith(embed)) return
      const inSpace = path.slice(embed.length)
      // '/embed/spaces/a1b' is another space.
      if (!/^([/?]|$)/.test(inSpace)) return
      void navigate(`/spaces/${spaceId}/tasks${inSpace}`, { replace: true })
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [embed, navigate, origin, spaceId])

  return (
    <iframe
      ref={frame}
      title={t('tabs.tasks')}
      src={src}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      className="u-w-100 u-flex-auto u-bdw-0"
      onLoad={sendTheme}
    />
  )
}
