import { Alert, Button, Link, Tab, Tabs, Typography } from '@linagora/twake-mui'
import { useEffect, useState, type ReactElement } from 'react'
import {
  Navigate,
  Link as RouterLink,
  useNavigate,
  useParams
} from 'react-router'

import { isRefusal } from '@/application/spaces'
import { PREPARING_MS, spaceTabs } from '@/application/spaceTabs'
import { NameAvatar } from '@/ds/AppFrame'
import { KeptAlive, KeptAliveStack } from '@/ds/KeptAlive'
import { LoadingRows, Page, SpaceHeader, TabPanel } from '@/ds/Page'
import { useI18n } from '@/ui/i18n/useI18n'
import { FeedPanel } from '@/ui/space/FeedPanel'
import { MailPanel } from '@/ui/space/MailPanel'
import { MembersPanel } from '@/ui/space/MembersPanel'
import { useFeed } from '@/ui/space/feedQueries'
import { SpaceActions } from '@/ui/space/SpaceActions'
import { TasksPanel } from '@/ui/space/TasksPanel'
import { useSpace } from '@/ui/spaces/queries'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

function useNowAfter(at: number): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setNow(Date.now())
      },
      Math.max(0, at - Date.now())
    )
    return () => {
      clearTimeout(timer)
    }
  }, [at])
  return now
}

// The tabs that frame an app: once opened, their frame stays alive in the
// space (ADR 010), hidden on the other tabs.
const FRAMED_TABS = ['tasks', 'mail'] as const
type FramedTab = (typeof FRAMED_TABS)[number]

function isFramed(tab: string): tab is FramedTab {
  return (FRAMED_TABS as readonly string[]).includes(tab)
}

// The framed tabs opened in this space. Another space starts empty: its
// frames show other resources, and the old ones go with their history.
function useOpenedFrames(
  spaceId: string,
  tab: string | null
): ReadonlySet<FramedTab> {
  const [opened, setOpened] = useState<{
    spaceId: string
    tabs: ReadonlySet<FramedTab>
  }>({ spaceId, tabs: new Set() })
  const current =
    opened.spaceId === spaceId ? opened.tabs : new Set<FramedTab>()
  if (tab !== null && isFramed(tab) && !current.has(tab)) {
    setOpened({ spaceId, tabs: new Set([...current, tab]) })
  } else if (opened.spaceId !== spaceId) {
    setOpened({ spaceId, tabs: current })
  }
  return current
}

export function SpaceScreen(): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { spaceId = '', tab } = useParams()
  const space = useSpace(spaceId)
  useDocumentTitle(space.data?.name ?? null)
  const now = useNowAfter(
    space.data ? Date.parse(space.data.createdAt) + PREPARING_MS : 0
  )
  const readyTab =
    space.data &&
    tab !== undefined &&
    spaceTabs(space.data, now).some(
      item => item.tab === tab && item.state === 'ready'
    )
      ? tab
      : null
  const opened = useOpenedFrames(spaceId, readyTab)
  const feed = useFeed(spaceId, 'all', readyTab === 'feed')
  const emptyFeed = feed.data?.pages[0]?.items.length === 0

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

  const tabs = spaceTabs(space.data, now)
  const current = tabs.find(item => item.tab === tab && item.state !== 'off')
  if (!current) {
    const first = tabs.find(item => item.state !== 'off')
    return <Navigate to={`/spaces/${spaceId}/${first?.tab ?? ''}`} replace />
  }
  const label = t(`tabs.${current.tab}`)
  const resource = (kind: string) =>
    space.data.resources.find(r => r.kind === kind)?.id
  const project = resource('project')
  const mailbox = resource('mailbox')
  const framed =
    current.state === 'ready' &&
    (current.tab === 'tasks' || current.tab === 'mail')

  return (
    <Page>
      <SpaceHeader
        compact={framed || (current.tab === 'feed' && !emptyFeed)}
        avatar={
          <NameAvatar
            name={space.data.name}
            color={space.data.color}
            size="m"
          />
        }
        title={space.data.name}
        actions={<SpaceActions space={space.data} />}
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
      <TabPanel tab={current.tab}>
        {current.state === 'preparing' && (
          <Typography>{t('space.preparing', { app: label })}</Typography>
        )}
        {current.state === 'stalled' && (
          <Alert
            severity="warning"
            action={
              <Button
                size="small"
                disabled={space.isFetching}
                onClick={() => {
                  void space.refetch()
                }}
              >
                {t('space.checkAgain')}
              </Button>
            }
          >
            {t('space.stalled', { app: label })}
          </Alert>
        )}
        {current.tab === 'feed' && <FeedPanel space={space.data} />}
        {current.tab === 'members' && <MembersPanel space={space.data} />}
        <KeptAliveStack active={framed}>
          {opened.has('tasks') && project && (
            <KeptAlive active={current.tab === 'tasks'}>
              <TasksPanel
                spaceId={spaceId}
                projectId={project}
                active={current.tab === 'tasks'}
              />
            </KeptAlive>
          )}
          {opened.has('mail') && mailbox && (
            <KeptAlive active={current.tab === 'mail'}>
              <MailPanel
                spaceId={spaceId}
                mailboxId={mailbox}
                active={current.tab === 'mail'}
              />
            </KeptAlive>
          )}
        </KeptAliveStack>
      </TabPanel>
    </Page>
  )
}
