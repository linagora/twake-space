import { Alert, Chip, Link, Tab, Tabs, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import {
  Navigate,
  Link as RouterLink,
  useNavigate,
  useParams
} from 'react-router'

import { isRefusal } from '@/application/spaces'
import { spaceTabs } from '@/application/spaceTabs'
import { NameAvatar } from '@/ds/AppFrame'
import { LoadingRows, Page, SpaceHeader } from '@/ds/Page'
import { useI18n } from '@/ui/i18n/useI18n'
import { FeedPanel } from '@/ui/space/FeedPanel'
import { MembersPanel } from '@/ui/space/MembersPanel'
import { SpaceActions } from '@/ui/space/SpaceActions'
import { TasksPanel } from '@/ui/space/TasksPanel'
import { useSpace } from '@/ui/spaces/queries'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

export function SpaceScreen(): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { spaceId = '', tab } = useParams()
  const space = useSpace(spaceId)
  useDocumentTitle(space.data?.name ?? null)

  if (space.isPending) {
    return (
      <Page>
        <LoadingRows count={3} label={t('space.loading')} />
      </Page>
    )
  }
  if (space.isError) {
    return (
      <Page>
        <Alert severity="error" className="u-mb-1">
          {t(
            isRefusal(space.error) && space.error.status === 404
              ? 'space.notFound'
              : 'space.loadFailed'
          )}
        </Alert>
        <Link component={RouterLink} to="/">
          {t('space.back')}
        </Link>
      </Page>
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
    <Page>
      <SpaceHeader
        avatar={<NameAvatar name={space.data.name} size="m" />}
        title={space.data.name}
        meta={
          <>
            <Chip
              label={t(`roles.${space.data.role}`)}
              size="small"
              variant="outlined"
            />
            <SpaceActions space={space.data} />
          </>
        }
        tabs={
          <Tabs
            narrowed
            variant="scrollable"
            scrollButtons={false}
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
        }
      />
      {!space.data.chat && (
        <Alert severity="info" className="u-mb-1">
          {t('space.chatOff')}
        </Alert>
      )}
      {!space.data.mail && (
        <Alert severity="info" className="u-mb-1">
          {t('space.mailOff')}
        </Alert>
      )}
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
          space.data.homeserverUrl &&
          matrixSpace && (
            <FeedPanel
              homeserverUrl={space.data.homeserverUrl}
              roomId={matrixSpace}
            />
          )}
        {current.state === 'ready' && current.tab === 'tasks' && (
          <TasksPanel spaceId={spaceId} />
        )}
        {current.tab === 'members' && <MembersPanel space={space.data} />}
      </div>
    </Page>
  )
}
