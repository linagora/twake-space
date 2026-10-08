import { Alert, Button, Link, Tab, Tabs, Typography } from '@linagora/twake-mui'
import { useEffect, useState, type ReactElement } from 'react'
import {
  Navigate,
  Link as RouterLink,
  useNavigate,
  useParams
} from 'react-router'

import { badgeLabel, tabCount } from '@/application/badges'
import { embeddedApp } from '@/application/embeddedApps'
import { isRefusal } from '@/application/spaces'
import { PREPARING_MS, spaceTabs } from '@/application/spaceTabs'
import { NameAvatar } from '@/ds/AppFrame'
import { CountedLabel } from '@/ds/CountedLabel'
import { LoadingRows, Page, SpaceHeader, TabPanel } from '@/ds/Page'
import { useSpaceTabTag } from '@/ui/feedback/useSpaceTabTag'
import { useI18n } from '@/ui/i18n/useI18n'
import { useBadges } from '@/ui/space/Badges'
import { useAppUrls } from '@/ui/space/useAppUrls'
import { FeedPanel } from '@/ui/space/FeedPanel'
import { SpaceActions } from '@/ui/space/SpaceActions'
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

export function SpaceScreen(): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { spaceId = '', tab } = useParams()
  const appUrls = useAppUrls()
  const badges = useBadges()
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
  useSpaceTabTag(readyTab)
  // Once the feed scrolls, the cover stays folded until another space opens.
  const [foldedIn, setFoldedIn] = useState<string | null>(null)

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
  // The frame of an embedded app follows the page, under the shell
  const embedded = current.state === 'ready' ? embeddedApp(current.tab) : null
  const embeddedUrl = embedded ? appUrls[embedded.app] : null
  const framed = embedded !== null && embeddedUrl !== null

  return (
    <Page fill={!framed}>
      <SpaceHeader
        avatar={
          <NameAvatar
            name={space.data.name}
            color={space.data.color}
            size="m"
          />
        }
        title={space.data.name}
        actions={<SpaceActions space={space.data} />}
        cover={current.tab === 'feed' && foldedIn !== spaceId}
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
            {tabs.map(item => {
              const app = embeddedApp(item.tab)
              const count = app ? tabCount(badges, space.data, app.app) : 0
              const name = t(`tabs.${item.tab}`)
              return (
                <Tab
                  key={item.tab}
                  value={item.tab}
                  label={
                    <CountedLabel label={name} count={badgeLabel(count)} />
                  }
                  aria-label={
                    count > 0
                      ? t('tabs.withCount', { app: name, smart_count: count })
                      : undefined
                  }
                  disabled={item.state === 'off'}
                  id={`tab-${item.tab}`}
                  aria-controls={`panel-${item.tab}`}
                />
              )
            })}
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
      {/* A framed tab's panel is the frame itself, under the shell */}
      {!framed && (
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
          {current.tab === 'feed' && (
            <FeedPanel
              space={space.data}
              onScrolledAway={() => {
                setFoldedIn(spaceId)
              }}
            />
          )}
          {embedded && embeddedUrl === null && (
            <Typography>{t(`${embedded.app}.notSetUp`)}</Typography>
          )}
        </TabPanel>
      )}
    </Page>
  )
}
