import { Copy, Icon } from '@linagora/twake-icons'
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import type { SpaceRole } from '@/application/spaces'
import {
  TOKEN_LIFETIMES,
  TOKEN_SCOPES,
  type CreatedToken,
  type TokenLifetime,
  type TokenOwner,
  type TokenScope
} from '@/application/tokens'
import { useI18n } from '@/ui/i18n/useI18n'
import { RoleSelect } from '@/ui/space/RoleSelect'
import { useSpaceList } from '@/ui/spaces/queries'
import { useCreateToken } from '@/ui/tokens/queries'
import { TokenDialog, TokenError } from '@/ui/tokens/TokenDialogs'

function toggled<T>(values: T[], value: T, on: boolean): T[] {
  return on ? [...values, value] : values.filter(v => v !== value)
}

export function CreateTokenDialog({
  owner,
  onClose,
  onCreated
}: {
  owner: TokenOwner
  onClose: () => void
  onCreated: (created: CreatedToken) => void
}): ReactElement {
  const { t } = useI18n()
  const scopesId = useId()
  const spacesId = useId()
  const create = useCreateToken(owner)
  const spaces = useSpaceList().data ?? []
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<TokenScope[]>(['space:read'])
  const [allSpaces, setAllSpaces] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [role, setRole] = useState<SpaceRole>('viewer')
  const [lifetime, setLifetime] = useState<TokenLifetime>(30)
  const trimmed = name.trim()
  const ready =
    trimmed !== '' && scopes.length > 0 && (allSpaces || picked.length > 0)
  // Unmounting mid-request drops mutate's onSuccess, and with it the only
  // chance to show the secret.
  const close = () => {
    if (!create.isPending) onClose()
  }

  return (
    <TokenDialog
      title={t(`apiTokens.createTitle.${owner}`)}
      onClose={close}
      onSubmit={() => {
        create.mutate(
          {
            name: trimmed,
            scopes,
            spaces: allSpaces ? 'all' : picked,
            ...(owner === 'organization' && { role }),
            expiresInDays: lifetime
          },
          { onSuccess: onCreated }
        )
      }}
      actions={
        <>
          <Button variant="text" onClick={close} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!ready || create.isPending}
          >
            {t('common.create')}
          </Button>
        </>
      }
    >
      <TokenError error={create.error} />
      <TextField
        label={t('apiTokens.name')}
        helperText={t('apiTokens.nameHint')}
        value={name}
        onChange={event => {
          setName(event.target.value)
        }}
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <div>
        <Typography id={scopesId} variant="subtitle2" component="h3">
          {t('apiTokens.scopes')}
        </Typography>
        <FormGroup aria-labelledby={scopesId}>
          {TOKEN_SCOPES.map(scope => (
            <FormControlLabel
              key={scope}
              label={t(`apiTokens.scope.${scope}`)}
              control={
                <Checkbox
                  checked={scopes.includes(scope)}
                  onChange={(_event, on) => {
                    setScopes(toggled(scopes, scope, on))
                  }}
                />
              }
            />
          ))}
        </FormGroup>
      </div>
      <div>
        <Typography id={spacesId} variant="subtitle2" component="h3">
          {t('apiTokens.spaces')}
        </Typography>
        <RadioGroup
          aria-labelledby={spacesId}
          value={allSpaces ? 'all' : 'some'}
          onChange={(_event, value) => {
            setAllSpaces(value === 'all')
          }}
        >
          <FormControlLabel
            value="all"
            control={<Radio />}
            label={t('apiTokens.allSpaces')}
          />
          <FormControlLabel
            value="some"
            control={<Radio />}
            label={t('apiTokens.pickSpaces')}
          />
        </RadioGroup>
        {!allSpaces && (
          <FormGroup className="u-ml-2">
            {spaces.map(space => (
              <FormControlLabel
                key={space.id}
                label={space.name}
                control={
                  <Checkbox
                    checked={picked.includes(space.id)}
                    onChange={(_event, on) => {
                      setPicked(toggled(picked, space.id, on))
                    }}
                  />
                }
              />
            ))}
          </FormGroup>
        )}
      </div>
      {owner === 'organization' && (
        <RoleSelect
          label={t('apiTokens.role')}
          value={role}
          onChange={setRole}
          hiddenLabel={false}
        />
      )}
      <TextField
        select
        size="small"
        label={t('apiTokens.lifetime')}
        value={lifetime}
        onChange={event => {
          setLifetime(Number(event.target.value) as TokenLifetime)
        }}
        slotProps={{ select: { native: true } }}
      >
        {TOKEN_LIFETIMES.map(days => (
          <option key={days} value={days}>
            {t('apiTokens.days', { smart_count: days })}
          </option>
        ))}
      </TextField>
    </TokenDialog>
  )
}

export function TokenSecretDialog({
  created,
  onClose
}: {
  created: CreatedToken
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  return (
    <TokenDialog
      title={t('apiTokens.secretTitle', { name: created.name })}
      onClose={onClose}
      closeOnBackdrop={false}
      onSubmit={onClose}
      actions={
        <Button type="submit" variant="contained">
          {t('apiTokens.done')}
        </Button>
      }
    >
      <Alert severity="warning">{t('apiTokens.secretHint')}</Alert>
      <TextField
        label={t('apiTokens.secret')}
        value={created.token}
        slotProps={{
          htmlInput: { readOnly: true },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={t('apiTokens.copy')}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(created.token)
                      .then(() => {
                        setCopied(true)
                      })
                  }}
                >
                  <Icon icon={Copy} />
                </IconButton>
              </InputAdornment>
            )
          }
        }}
      />
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => {
          setCopied(false)
        }}
        message={t('apiTokens.copied')}
      />
    </TokenDialog>
  )
}
