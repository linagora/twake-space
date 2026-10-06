import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemText
} from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactElement } from 'react'

import {
  FEED_CATEGORIES,
  type FeedEntry,
  type FeedFilter,
  type FeedPage,
  type FeedView
} from '@/application/feed'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

const FILTERS: FeedFilter[] = ['all', ...FEED_CATEGORIES]

export function FeedPanel({
  serverName,
  roomId
}: {
  serverName: string
  roomId: string
}): ReactElement {
  const { t } = useI18n()
  const { matrix } = useServices()
  const signIn = useQuery({
    queryKey: ['matrix', serverName],
    queryFn: () => matrix.signIn(serverName),
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
  return <FeedTimeline roomId={roomId} />
}

function FeedTimeline({ roomId }: { roomId: string }): ReactElement {
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
      <FeedEntries key={filter} roomId={roomId} filter={filter} />
    </section>
  )
}

function FeedEntries({
  roomId,
  filter
}: {
  roomId: string
  filter: FeedFilter
}): ReactElement {
  const { t } = useI18n()
  const { feed } = useServices()
  const [page, setPage] = useState<FeedPage | null>(null)
  const [view, setView] = useState<FeedView | null>(null)
  const [failed, setFailed] = useState(false)

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
            <Button onClick={() => void view.loadOlder()}>
              {t('feed.loadOlder')}
            </Button>
          )}
          {page.entries.length === 0 && !page.hasOlder && (
            <Alert severity="info">{t('feed.empty')}</Alert>
          )}
          <List>
            {page.entries.map(entry => (
              <ListItem key={entry.id}>
                <Entry entry={entry} />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </>
  )
}

function Entry({ entry }: { entry: FeedEntry }): ReactElement {
  if (entry.kind === 'message') {
    return <ListItemText primary={entry.body} secondary={entry.sender} />
  }
  return (
    <ListItemText
      primary={
        <Link href={entry.object.url} target="_blank" rel="noreferrer">
          {entry.object.title}
        </Link>
      }
      secondary={entry.preview}
    />
  )
}
