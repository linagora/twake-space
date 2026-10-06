import {
  Alert,
  Chip,
  CircularProgress,
  Link,
  Tab,
  Tabs,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import {
  Navigate,
  Link as RouterLink,
  useNavigate,
  useParams
} from 'react-router'

import { spaceTabs } from '@/application/spaceTabs'
import { useI18n } from '@/ui/i18n/useI18n'
import { FeedPanel } from '@/ui/space/FeedPanel'
import { TasksPanel } from '@/ui/space/TasksPanel'
import { useSpace } from '@/ui/spaces/queries'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  )
}

export function SpaceScreen(): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { spaceId = '', tab } = useParams()
  const space = useSpace(spaceId)
  useDocumentTitle(space.data?.name ?? null)

  if (space.isPending) {
    return <CircularProgress aria-label={t('space.loading')} />
  }
  if (space.isError) {
    return (
      <main className="u-p-2">
        <Alert severity="error">
          {t(isNotFound(space.error) ? 'space.notFound' : 'space.loadFailed')}
        </Alert>
        <Link component={RouterLink} to="/">
          {t('space.back')}
        </Link>
      </main>
    )
  }

  const tabs = spaceTabs(space.data)
  const current = tabs.find(item => item.tab === tab && item.state !== 'off')
  if (!current) {
    const first = tabs.find(item => item.state !== 'off')
    return <Navigate to={`/spaces/${spaceId}/${first?.tab ?? ''}`} replace />
  }
  const label = t(`tabs.${current.tab}`)
  const matrixSpace = space.data.resources.find(
    r => r.kind === 'matrix_space'
  )?.id

  return (
    <main className="u-p-2 u-flex u-flex-column u-h-100">
      <Link component={RouterLink} to="/">
        {t('space.back')}
      </Link>
      <Typography variant="h1">{space.data.name}</Typography>
      <Chip label={t(`roles.${space.data.role}`)} size="small" />
      <Tabs
        value={current.tab}
        onChange={(_event, value: string) => {
          void navigate(`/spaces/${spaceId}/${value}`)
        }}
      >
        {tabs.map(item => (
          <Tab
            key={item.tab}
            value={item.tab}
            label={t(`tabs.${item.tab}`)}
            disabled={item.state === 'off'}
            id={`tab-${item.tab}`}
            aria-controls={`panel-${item.tab}`}
          />
        ))}
      </Tabs>
      {!space.data.chat && <Alert severity="info">{t('space.chatOff')}</Alert>}
      {!space.data.mail && <Alert severity="info">{t('space.mailOff')}</Alert>}
      <div
        role="tabpanel"
        id={`panel-${current.tab}`}
        aria-labelledby={`tab-${current.tab}`}
        className="u-flex u-flex-column u-flex-auto"
      >
        {current.state === 'preparing' && (
          <Typography>{t('space.preparing', { app: label })}</Typography>
        )}
        {current.state === 'ready' &&
          current.tab === 'feed' &&
          space.data.serverName &&
          matrixSpace && (
            <FeedPanel
              serverName={space.data.serverName}
              roomId={matrixSpace}
            />
          )}
        {current.state === 'ready' && current.tab === 'tasks' && (
          <TasksPanel spaceId={spaceId} />
        )}
      </div>
    </main>
  )
}
