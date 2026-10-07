import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  Typography,
  type DialogSize
} from '@linagora/twake-mui'
import {
  useId,
  useState,
  type ReactElement,
  type ReactNode,
  type SubmitEvent
} from 'react'

import { isRefusal } from '@/application/spaces'
import type { ApiToken, TokenOwner } from '@/application/tokens'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useTokenWrite } from '@/ui/tokens/queries'

// The backend's reason carries the policy that refused a token, so it beats
// a generic message.
export function TokenError({
  error
}: {
  error: Error | null
}): ReactElement | null {
  const { t } = useI18n()
  if (!error) return null
  return (
    <Alert severity="error">
      {isRefusal(error) && error.reason
        ? t('apiTokens.refused', { reason: error.reason })
        : t('apiTokens.failed')}
    </Alert>
  )
}

export function TokenDialog({
  title,
  onClose,
  onSubmit,
  actions,
  children,
  persistent = false,
  size = 'small'
}: {
  title: string
  onClose: () => void
  onSubmit: () => void
  actions: ReactNode
  children: ReactNode
  /** Only the dialog's own buttons close it, not a backdrop click or Escape. */
  persistent?: boolean
  size?: DialogSize
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  return (
    <Dialog
      open
      onClose={() => {
        if (!persistent) onClose()
      }}
      aria-labelledby={titleId}
      size={size}
      // The paper is the form, so only the content scrolls and the actions
      // stay in view on a full-screen phone dialog.
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: (event: SubmitEvent) => {
            event.preventDefault()
            onSubmit()
          }
        }
      }}
    >
      <DialogHeader
        id={titleId}
        title={title}
        close={{ label: t('common.close'), onClick: onClose }}
      />
      <DialogContent>
        <Stack spacing={2}>{children}</Stack>
      </DialogContent>
      <DialogActions>{actions}</DialogActions>
    </Dialog>
  )
}

export function RenameTokenDialog({
  owner,
  token,
  onClose
}: {
  owner: TokenOwner
  token: ApiToken
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const write = useTokenWrite(owner)
  const [name, setName] = useState(token.name)
  const trimmed = name.trim()
  return (
    <TokenDialog
      title={t('apiTokens.renameTitle')}
      onClose={onClose}
      onSubmit={() => {
        write.mutate(tokens => tokens.rename(owner, token.id, trimmed), {
          onSuccess: onClose
        })
      }}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={trimmed === '' || write.isPending}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <TokenError error={write.error} />
      <TextField
        // A dialog moves focus to its first field (WAI-ARIA dialog pattern).
        // eslint-disable-next-line jsx-a11y-x/no-autofocus
        autoFocus
        required
        label={t('apiTokens.name')}
        value={name}
        onChange={event => {
          setName(event.target.value)
        }}
        onFocus={event => {
          event.target.select()
        }}
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
    </TokenDialog>
  )
}

export function RevokeTokenDialog({
  owner,
  token,
  onClose
}: {
  owner: TokenOwner
  token: ApiToken
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const write = useTokenWrite(owner)
  return (
    <TokenDialog
      title={t('apiTokens.revokeTitle', { name: token.name })}
      onClose={onClose}
      onSubmit={() => {
        write.mutate(tokens => tokens.revoke(owner, token.id), {
          onSuccess: onClose
        })
      }}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={write.isPending}
          >
            {t('apiTokens.revokeConfirm')}
          </Button>
        </>
      }
    >
      <TokenError error={write.error} />
      <Typography>{t('apiTokens.revokeHint')}</Typography>
    </TokenDialog>
  )
}
