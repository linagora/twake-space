import { Typography, useColorScheme } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { EmbeddedAppFrame } from '@/ui/space/EmbeddedAppFrame'

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

  const loaded = useRef(false)
  const sendTheme = () => {
    // Until Tasks loads, the frame holds about:blank on this page's origin.
    if (!loaded.current) return
    frame.current?.contentWindow?.postMessage(
      { type: 'twake-space:theme', theme },
      origin
    )
  }
  useEffect(sendTheme)

  return (
    <EmbeddedAppFrame
      appUrl={tasksUrl}
      embedPath={`/embed/projects/${projectId}`}
      tabPath={`/spaces/${spaceId}/tasks`}
      title={t('tabs.tasks')}
      frameRef={frame}
      onFrameLoad={() => {
        loaded.current = true
        sendTheme()
      }}
      onFrameMessage={(data, follow) => {
        const path = framedPath(data)
        if (path) follow(path)
      }}
    />
  )
}
