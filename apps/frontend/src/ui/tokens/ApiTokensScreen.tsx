import { Icon, Previous } from '@linagora/twake-icons'
import { Link, Tab, Tabs, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import {
  Link as RouterLink,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router'

import type { TokenOwner } from '@/application/tokens'
import { Page, TabPanel } from '@/ds/Page'
import { SplitLayout } from '@/ds/Panel'
import { useI18n } from '@/ui/i18n/useI18n'
import { QuickStart } from '@/ui/tokens/ApiUsage'
import { TokensPanel } from '@/ui/tokens/TokensPanel'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

const OWNERS: TokenOwner[] = ['personal', 'organization']

function isOwner(value: string): value is TokenOwner {
  return (OWNERS as string[]).includes(value)
}

export function ApiTokensScreen(): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { owner = 'personal' } = useParams()
  // The space settings that linked here, so the page can lead back to them.
  const [params] = useSearchParams()
  const spaceId = params.get('space')
  const search = spaceId ? `?space=${encodeURIComponent(spaceId)}` : ''
  useDocumentTitle(t('apiTokens.title'))
  if (!isOwner(owner)) {
    return (
      <Navigate to={{ pathname: '/settings/api-tokens', search }} replace />
    )
  }

  return (
    <Page>
      <Link
        component={RouterLink}
        to={spaceId ? `/spaces/${encodeURIComponent(spaceId)}/settings` : '/'}
        underline="none"
        className="u-inline-flex u-flex-items-center u-flex-self-start u-mb-1"
      >
        <Icon icon={Previous} className="u-mr-half" />
        {t('common.back')}
      </Link>
      <Typography variant="h3" component="h1">
        {t('apiTokens.title')}
      </Typography>
      <Typography color="textSecondary" className="u-mt-half u-mb-1 u-maw-7">
        {t('apiTokens.intro')}
      </Typography>
      <Tabs
        narrowed
        value={owner}
        onChange={(_event, value: TokenOwner) => {
          void navigate({ pathname: `/settings/api-tokens/${value}`, search })
        }}
        className="u-mb-1"
      >
        {OWNERS.map(item => (
          <Tab
            key={item}
            value={item}
            label={t(`apiTokens.tabs.${item}`)}
            id={`tab-${item}`}
            aria-controls={`panel-${item}`}
          />
        ))}
      </Tabs>
      <SplitLayout
        main={
          <TabPanel tab={owner}>
            <TokensPanel key={owner} owner={owner} />
          </TabPanel>
        }
        aside={<QuickStart />}
      />
    </Page>
  )
}
