import { Dots, Icon, Key, Plus, Rename, Trash } from '@linagora/twake-icons'
import {
  Alert,
  Button,
  Chip,
  IconButton,
  Menu,
  Stack,
  Typography
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { isRefusal } from '@/application/spaces'
import type { ApiToken, CreatedToken, TokenOwner } from '@/application/tokens'
import { MenuEntry } from '@/ds/Menu'
import { LoadingRows } from '@/ds/Page'
import { EmptyCard, IconTile, ItemCard, ItemList } from '@/ds/Panel'
import { useI18n } from '@/ui/i18n/useI18n'
import {
  CreateTokenDialog,
  TokenSecretDialog
} from '@/ui/tokens/CreateTokenDialog'
import { useTokens } from '@/ui/tokens/queries'
import { RenameTokenDialog, RevokeTokenDialog } from '@/ui/tokens/TokenDialogs'

type Opened =
  | { kind: 'create' }
  | { kind: 'secret'; created: CreatedToken }
  | { kind: 'rename' | 'revoke'; token: ApiToken }

const DAY_MS = 24 * 60 * 60 * 1000
// Below this, an expiry is close enough to warn about.
const SOON_DAYS = 7

export function TokensPanel({ owner }: { owner: TokenOwner }): ReactElement {
  const { t } = useI18n()
  const listId = useId()
  const tokens = useTokens(owner)
  const [now] = useState(Date.now)
  const [opened, setOpened] = useState<Opened | null>(null)
  const close = () => {
    setOpened(null)
  }
  const create = (
    <Button
      variant="contained"
      startIcon={<Icon icon={Plus} />}
      onClick={() => {
        setOpened({ kind: 'create' })
      }}
    >
      {t('apiTokens.create')}
    </Button>
  )

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
      {tokens.data.length === 0 ? (
        <EmptyCard
          icon={
            <IconTile>
              <Icon icon={Key} />
            </IconTile>
          }
          title={t(`apiTokens.empty.${owner}`)}
          text={t('apiTokens.emptyText')}
          action={create}
        />
      ) : (
        <>
          <Stack
            direction="row"
            spacing={2}
            className="u-flex-items-center u-flex-justify-between u-mb-1"
          >
            <Typography variant="h5" component="h2" id={listId}>
              {t(`apiTokens.heading.${owner}`)}
            </Typography>
            {create}
          </Stack>
          <ItemList labelledBy={listId}>
            {tokens.data.map(token => (
              <TokenCard
                key={token.id}
                token={token}
                now={now}
                onRename={() => {
                  setOpened({ kind: 'rename', token })
                }}
                onRevoke={() => {
                  setOpened({ kind: 'revoke', token })
                }}
              />
            ))}
          </ItemList>
        </>
      )}
      {opened?.kind === 'create' && (
        <CreateTokenDialog
          owner={owner}
          onClose={close}
          onCreated={created => {
            setOpened({ kind: 'secret', created })
          }}
        />
      )}
      {opened?.kind === 'secret' && (
        <TokenSecretDialog created={opened.created} onClose={close} />
      )}
      {opened?.kind === 'rename' && (
        <RenameTokenDialog owner={owner} token={opened.token} onClose={close} />
      )}
      {opened?.kind === 'revoke' && (
        <RevokeTokenDialog owner={owner} token={opened.token} onClose={close} />
      )}
    </section>
  )
}

function ExpiryChip({
  expiresAt,
  now
}: {
  expiresAt: string | null
  now: number
}): ReactElement {
  const { t, lang } = useI18n()
  if (!expiresAt) {
    return (
      <Chip
        size="small"
        variant="outlined"
        label={t('apiTokens.neverExpires')}
      />
    )
  }
  const days = Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS)
  if (days <= 0) {
    return <Chip size="small" color="error" label={t('apiTokens.expired')} />
  }
  const when = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(
    days,
    'day'
  )
  return (
    <Chip
      size="small"
      variant={days <= SOON_DAYS ? 'filled' : 'outlined'}
      color={days <= SOON_DAYS ? 'warning' : 'default'}
      label={t('apiTokens.expiresWhen', { when })}
      title={new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(
        new Date(expiresAt)
      )}
    />
  )
}

function TokenCard({
  token,
  now,
  onRename,
  onRevoke
}: {
  token: ApiToken
  now: number
  onRename: () => void
  onRevoke: () => void
}): ReactElement {
  const { t, lang } = useI18n()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' })
  const relative = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const ago = (iso: string) => {
    const days = Math.round((new Date(iso).getTime() - now) / DAY_MS)
    return relative.format(days, 'day')
  }
  const meta = [
    t('apiTokens.createdOn', { date: date.format(new Date(token.createdAt)) }),
    token.lastUsedAt
      ? t('apiTokens.lastUsed', { date: ago(token.lastUsedAt) })
      : t('apiTokens.neverUsed')
  ].join(' · ')
  const pick = (then: () => void) => () => {
    setAnchor(null)
    then()
  }

  return (
    <ItemCard
      icon={
        <IconTile>
          <Icon icon={Key} />
        </IconTile>
      }
      title={token.name}
      status={<ExpiryChip expiresAt={token.expiresAt} now={now} />}
      meta={meta}
      chips={
        <>
          {token.scopes.map(scope => (
            <Chip
              key={scope}
              size="small"
              label={t(`apiTokens.scope.${scope}`)}
            />
          ))}
          <Chip
            size="small"
            variant="outlined"
            label={
              token.spaces === 'all'
                ? t('apiTokens.allSpaces')
                : t('apiTokens.someSpaces', {
                    smart_count: token.spaces.length
                  })
            }
          />
          {token.role && (
            <Chip
              size="small"
              variant="outlined"
              color="primary"
              label={t(`roles.${token.role}`)}
            />
          )}
        </>
      }
      menu={
        <>
          <IconButton
            aria-label={t('apiTokens.actions', { name: token.name })}
            aria-haspopup="menu"
            onClick={event => {
              setAnchor(event.currentTarget)
            }}
          >
            <Icon icon={Dots} />
          </IconButton>
          <Menu
            anchorEl={anchor}
            open={anchor !== null}
            onClose={() => {
              setAnchor(null)
            }}
          >
            <MenuEntry icon={<Icon icon={Rename} />} onClick={pick(onRename)}>
              {t('apiTokens.renameAction')}
            </MenuEntry>
            <MenuEntry
              icon={<Icon icon={Trash} />}
              onClick={pick(onRevoke)}
              danger
            >
              {t('apiTokens.revokeConfirm')}
            </MenuEntry>
          </Menu>
        </>
      }
    />
  )
}
