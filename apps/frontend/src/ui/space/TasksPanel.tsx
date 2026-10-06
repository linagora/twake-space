import { Typography, useColorScheme } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useEmbedPath } from '@/ui/space/useEmbedPath'

function framedPath(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const { type, path } = data as Record<string, unknown>
  return type === 'twake-tasks:path' && typeof path === 'string' ? path : null
}

export function TasksPanel({
  spaceId,
  projectId
}: {
  spaceId: string
  projectId: string
}): ReactElement {
  const { t } = useI18n()
  const { tasksUrl } = useServices()
  if (!tasksUrl) return <Typography>{t('tasks.notSetUp')}</Typography>
  return (
    <TasksFrame spaceId={spaceId} projectId={projectId} tasksUrl={tasksUrl} />
  )
}

function TasksFrame({
  spaceId,
  projectId,
  tasksUrl
}: {
  spaceId: string
  projectId: string
  tasksUrl: string
}): ReactElement {
  const { t } = useI18n()
  const { mode, systemMode } = useColorScheme()
  const theme = (mode === 'system' ? systemMode : mode) ?? 'light'
  const frame = useRef<HTMLIFrameElement>(null)
  const origin = new URL(tasksUrl).origin
  const { src, follow } = useEmbedPath(
    tasksUrl,
    `/embed/projects/${projectId}`,
    `/spaces/${spaceId}/tasks`
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
      if (path) follow(path)
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [follow, origin])

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
