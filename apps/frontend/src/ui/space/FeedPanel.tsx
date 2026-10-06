import {
  Calendar,
  Drive,
  Icon,
  Mail,
  Task,
  Videos,
  type IconProps
} from '@linagora/twake-icons'
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText
} from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactElement } from 'react'
import { Link as RouterLink } from 'react-router'

import {
  FEED_CATEGORIES,
  type Actor,
  type FeedEntry,
  type FeedFilter,
  type FeedPage,
  type FeedView
} from '@/application/feed'
import type { Member, Space } from '@/application/spaces'
import { NameAvatar } from '@/ds/AppFrame'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

type IconType = IconProps['icon']

const FILTERS: FeedFilter[] = ['all', ...FEED_CATEGORIES]

export function FeedPanel({
  homeserverUrl,
  roomId,
  space
}: {
  homeserverUrl: string
  roomId: string
  space: Space
}): ReactElement {
  const { t } = useI18n()
  const { matrix } = useServices()
  const signIn = useQuery({
    queryKey: ['matrix', homeserverUrl],
    queryFn: () => matrix.signIn(homeserverUrl),
    // A login token works once.
    retry: false,
    staleTime: Infinity
  })

  if (signIn.isError) {
    return <Alert severity="error">{t('feed.signInFailed')}</Alert>
  }
  if (!signIn.data) {
    return <CircularProgress aria-label={t('feed.signingIn')} />
  }
  return <FeedTimeline roomId={roomId} space={space} />
}

function FeedTimeline({
  roomId,
  space
}: {
  roomId: string
  space: Space
}): ReactElement {
  const { t } = useI18n()
  const [filter, setFilter] = useState<FeedFilter>('all')

  return (
    <section aria-label={t('tabs.feed')}>
      <div role="group" aria-label={t('feed.filter')}>
        {FILTERS.map(option => (
          <Chip
            key={option}
            label={t(`feed.filters.${option}`)}
            color={option === filter ? 'primary' : 'default'}
            aria-pressed={option === filter}
            onClick={() => {
              setFilter(option)
            }}
          />
        ))}
      </div>
      <FeedEntries key={filter} roomId={roomId} filter={filter} space={space} />
    </section>
  )
}

function FeedEntries({
  roomId,
  filter,
  space
}: {
  roomId: string
  filter: FeedFilter
  space: Space
}): ReactElement {
  const { t } = useI18n()
  const { feed } = useServices()
  const [page, setPage] = useState<FeedPage | null>(null)
  const [view, setView] = useState<FeedView | null>(null)
  const [failed, setFailed] = useState(false)
  const [olderFailed, setOlderFailed] = useState(false)

  useEffect(() => {
    let opened: FeedView | null = null
    let closed = false
    feed
      .open(roomId, filter, next => {
        if (!closed) setPage(next)
      })
      .then(
        next => {
          if (closed) next.close()
          else setView((opened = next))
        },
        () => {
          if (!closed) setFailed(true)
        }
      )
    return () => {
      closed = true
      opened?.close()
    }
  }, [feed, roomId, filter])

  return (
    <>
      {failed && <Alert severity="error">{t('feed.loadFailed')}</Alert>}
      {!failed && !page && <CircularProgress aria-label={t('feed.loading')} />}
      {page && (
        <>
          {page.hasOlder && view && (
            <Button
              onClick={() => {
                setOlderFailed(false)
                view.loadOlder().catch(() => {
                  setOlderFailed(true)
                })
              }}
            >
              {t('feed.loadOlder')}
            </Button>
          )}
          {olderFailed && (
            <Alert severity="error">{t('feed.loadOlderFailed')}</Alert>
          )}
          {page.entries.length === 0 && !page.hasOlder && (
            <Alert severity="info">{t('feed.empty')}</Alert>
          )}
          <List>
            {page.entries.map(entry => (
              <ListItem key={entry.id}>
                <Entry entry={entry} space={space} />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </>
  )
}

const APP_ICONS = {
  mail: Mail,
  drive: Drive,
  calendar: Calendar,
  meet: Videos,
  tasks: Task
} satisfies Record<string, IconType>

type App = keyof typeof APP_ICONS

function isApp(app: string | null): app is App {
  return app !== null && Object.hasOwn(APP_ICONS, app)
}

function useActorName(actor: Actor | null, members: Member[]): string | null {
  const { t } = useI18n()
  switch (actor?.type) {
    case undefined:
      return null
    case 'token':
      return actor.name
    case 'deleted_user':
      return t('feed.deletedUser')
    case 'user': {
      const member = members.find(
        m => m.id === actor.id || m.email === actor.email
      )
      return member?.username ?? actor.email ?? t('feed.someone')
    }
  }
}

// A card reaches the space's feed only when its container is one of the
// space's resources, so a Tasks URL here is inside the space's project, and
// the Tasks tab frames the same path.
function tasksTabPath(
  url: string,
  tasksUrl: string | null,
  space: Space
): string | null {
  if (!tasksUrl || !space.resources.some(r => r.kind === 'project' && r.id)) {
    return null
  }
  const target = new URL(url, tasksUrl)
  if (target.origin !== new URL(tasksUrl).origin) return null
  return `/spaces/${space.id}/tasks${target.pathname}${target.search}`
}

function Entry({
  entry,
  space
}: {
  entry: FeedEntry
  space: Space
}): ReactElement {
  if (entry.kind === 'card') return <Card entry={entry} space={space} />
  return (
    <>
      <ListItemAvatar>
        <NameAvatar name={entry.senderName} size="s" />
      </ListItemAvatar>
      <ListItemText primary={entry.body} secondary={entry.senderName} />
    </>
  )
}

function Card({
  entry,
  space
}: {
  entry: Extract<FeedEntry, { kind: 'card' }>
  space: Space
}): ReactElement {
  const { t } = useI18n()
  const { tasksUrl } = useServices()
  const actor = useActorName(entry.actor, space.members)
  const inTab = tasksTabPath(entry.object.url, tasksUrl, space)
  return (
    <>
      {actor && (
        <ListItemAvatar>
          <NameAvatar name={actor} size="s" />
        </ListItemAvatar>
      )}
      <ListItemText
        primary={
          <>
            {isApp(entry.app) && (
              <span role="img" aria-label={t(`feed.apps.${entry.app}`)}>
                <Icon icon={APP_ICONS[entry.app]} />
              </span>
            )}{' '}
            {inTab ? (
              <Link component={RouterLink} to={inTab}>
                {entry.object.title}
              </Link>
            ) : (
              <Link href={entry.object.url} target="_blank" rel="noreferrer">
                {entry.object.title}
              </Link>
            )}
          </>
        }
        secondary={
          <>
            {actor}
            {actor && entry.preview && ' · '}
            {entry.preview}
          </>
        }
      />
    </>
  )
}
