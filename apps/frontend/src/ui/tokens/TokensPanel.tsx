import {
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Typography
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { isRefusal } from '@/application/spaces'
import type { ApiToken, TokenOwner } from '@/application/tokens'
import { LoadingRows } from '@/ds/Page'
import { useI18n } from '@/ui/i18n/useI18n'
import { useTokens } from '@/ui/tokens/queries'

export function TokensPanel({ owner }: { owner: TokenOwner }): ReactElement {
  const { t } = useI18n()
  const listId = useId()
  const tokens = useTokens(owner)

  if (tokens.isPending) {
    return <LoadingRows label={t('apiTokens.loading')} count={2} />
  }
  if (tokens.isError) {
    const forbidden = isRefusal(tokens.error) && tokens.error.status === 403
    return (
      <Alert severity={forbidden ? 'info' : 'error'}>
        {t(forbidden ? 'apiTokens.adminsOnly' : 'apiTokens.loadFailed')}
      </Alert>
    )
  }

  return (
    <section>
      <Typography variant="h6" component="h2" id={listId}>
        {t(`apiTokens.heading.${owner}`)}
      </Typography>
      {tokens.data.length === 0 ? (
        <Typography color="textSecondary">
          {t(`apiTokens.empty.${owner}`)}
        </Typography>
      ) : (
        <List aria-labelledby={listId}>
          {tokens.data.map(token => (
            <TokenRow key={token.id} token={token} />
          ))}
        </List>
      )}
    </section>
  )
}

function TokenRow({ token }: { token: ApiToken }): ReactElement {
  const { t, lang } = useI18n()
  const formatter = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' })
  const date = (iso: string) => formatter.format(new Date(iso))
  const details = [
    token.scopes.map(scope => t(`apiTokens.scope.${scope}`)).join(', '),
    token.spaces === 'all'
      ? t('apiTokens.allSpaces')
      : t('apiTokens.someSpaces', { smart_count: token.spaces.length }),
    token.expiresAt
      ? t('apiTokens.expires', { date: date(token.expiresAt) })
      : t('apiTokens.neverExpires'),
    token.lastUsedAt
      ? t('apiTokens.lastUsed', { date: date(token.lastUsedAt) })
      : t('apiTokens.neverUsed')
  ]

  return (
    <ListItem>
      <ListItemText primary={token.name} secondary={details.join(' · ')} />
      {token.role && (
        <Chip
          label={t(`roles.${token.role}`)}
          size="small"
          variant="outlined"
        />
      )}
    </ListItem>
  )
}
