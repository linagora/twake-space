import { Icon, Rename, Trash } from '@linagora/twake-icons'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { isRefusal, type Space } from '@/application/spaces'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useDeleteSpace, useRenameSpace } from '@/ui/spaces/queries'

export function SpaceActions({ space }: { space: Space }): ReactElement | null {
  const { t } = useI18n()
  const [open, setOpen] = useState<'rename' | 'delete' | null>(null)
  if (space.role !== 'admin') return null
  const close = () => {
    setOpen(null)
  }
  return (
    <>
      <IconButton
        aria-label={t('spaceActions.rename')}
        onClick={() => {
          setOpen('rename')
        }}
      >
        <Icon icon={Rename} />
      </IconButton>
      <IconButton
        aria-label={t('spaceActions.delete')}
        onClick={() => {
          setOpen('delete')
        }}
      >
        <Icon icon={Trash} />
      </IconButton>
      {open === 'rename' && <RenameDialog space={space} onClose={close} />}
      {open === 'delete' && <DeleteDialog space={space} onClose={close} />}
    </>
  )
}

function WriteError({ error }: { error: Error | null }): ReactElement | null {
  const { t } = useI18n()
  if (!error) return null
  return (
    <Alert severity="error">
      {isRefusal(error) && error.code
        ? t('members.refused', { code: error.code })
        : t('members.failed')}
    </Alert>
  )
}

function RenameDialog({
  space,
  onClose
}: {
  space: Space
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const rename = useRenameSpace(space.id)
  const [name, setName] = useState(space.name)
  const trimmed = name.trim()
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <form
        onSubmit={event => {
          event.preventDefault()
          rename.mutate(trimmed, { onSuccess: onClose })
        }}
      >
        <DialogHeader
          id={titleId}
          title={t('spaceActions.rename')}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <DialogContent>
          <Stack spacing={2}>
            <WriteError error={rename.error} />
            <TextField
              label={t('createSpace.name')}
              value={name}
              onChange={event => {
                setName(event.target.value)
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={trimmed === '' || rename.isPending}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function DeleteDialog({
  space,
  onClose
}: {
  space: Space
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const navigate = useNavigate()
  const remove = useDeleteSpace(space.id)
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <DialogHeader
        id={titleId}
        title={t('spaceActions.deleteTitle', { name: space.name })}
        close={{ label: t('common.close'), onClick: onClose }}
      />
      <DialogContent>
        <Stack spacing={2}>
          <WriteError error={remove.error} />
          <Typography>{t('spaceActions.deleteHint')}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(undefined, {
              onSuccess: () => {
                void navigate('/', { replace: true })
              }
            })
          }}
        >
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
