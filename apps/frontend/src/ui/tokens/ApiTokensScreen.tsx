import { Tab, Tabs, Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import type { TokenOwner } from '@/application/tokens'
import { Page, TabPanel } from '@/ds/Page'
import { useI18n } from '@/ui/i18n/useI18n'
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
  useDocumentTitle(t('apiTokens.title'))
  if (!isOwner(owner)) return <Navigate to="/settings/api-tokens" replace />

  return (
    <Page>
      <Typography variant="h3" component="h1">
        {t('apiTokens.title')}
      </Typography>
      <Typography color="textSecondary" className="u-mt-half u-mb-1">
        {t('apiTokens.intro')}
      </Typography>
      <Tabs
        narrowed
        value={owner}
        onChange={(_event, value: TokenOwner) => {
          void navigate(`/settings/api-tokens/${value}`)
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
      <TabPanel tab={owner}>
        <TokensPanel key={owner} owner={owner} />
      </TabPanel>
    </Page>
  )
}
