import { useQueries } from '@tanstack/react-query'
import { useMemo, useState, type ReactElement } from 'react'

import { spaceNews, type FeedService } from '@/application/feed'
import { newsBrief, type SpaceBrief } from '@/application/newsBrief'
import { AssistantFrame } from '@/ui/assistant/AssistantPanel'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useFeedNews } from '@/ui/space/feedQueries'
import { useSpaceList } from '@/ui/spaces/queries'

// The page of a feed holds at most 50 items; the newest 20 tell enough.
const ITEMS = 20

const SUMMARY_INSTRUCTIONS =
  "The text lists what is new in the user's spaces since their last visit, " +
  'space by space, newest first. Summarise it for the user in a few short ' +
  'lines per space that has something worth knowing, their mentions first. ' +
  'Name each space. Write in the language of the request. Say nothing that ' +
  'is not in the text.'

// The items newer than the user's read time, as the news counts them.
const unreadQuery = (feed: FeedService, spaceId: string) => ({
  queryKey: ['feedUnread', spaceId],
  queryFn: async () => {
    const [readAt, page] = await Promise.all([
      feed.readAt(spaceId),
      feed.list(spaceId, { limit: ITEMS })
    ])
    const read = readAt === null ? Infinity : Date.parse(readAt)
    return page.items.filter(item => Date.parse(item.time) > read)
  },
  staleTime: Infinity,
  gcTime: 0,
  retry: false
})

// Undefined until every space is read. A space whose feed fails is left out;
// without the news or the spaces, the brief is empty.
function useNewsBrief(): string | undefined {
  const { feed } = useServices()
  const news = useFeedNews()
  const spaces = useSpaceList()
  const failed = news.isError || spaces.isError
  const entries =
    news.data && spaces.data ? spaceNews(news.data, spaces.data) : []
  return useQueries({
    queries: entries.map(({ space }) => unreadQuery(feed, space.id)),
    combine: results => {
      if (failed) return ''
      if (news.data === undefined || spaces.data === undefined) return undefined
      if (results.some(result => result.isPending)) return undefined
      return newsBrief(
        entries.flatMap(({ space, mentions }, index): SpaceBrief[] => {
          const items = results[index]?.data
          return items ? [{ name: space.name, mentions, items }] : []
        })
      )
    }
  })
}

export function HomeAssistant({
  onClose
}: {
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const read = useNewsBrief()
  // The first brief stays: news arriving while the panel is open would
  // otherwise reload the frame and drop the conversation.
  const [brief, setBrief] = useState<string>()
  if (brief === undefined && read !== undefined) setBrief(read)
  const config = useMemo(
    () =>
      brief === undefined
        ? null
        : {
            content: brief,
            suggestions:
              brief === ''
                ? []
                : [
                    {
                      name: 'summarise-news',
                      message: t('home.summaryRequest'),
                      instructions: SUMMARY_INSTRUCTIONS
                    }
                  ]
          },
    [brief, t]
  )
  return <AssistantFrame config={config} onClose={onClose} />
}
