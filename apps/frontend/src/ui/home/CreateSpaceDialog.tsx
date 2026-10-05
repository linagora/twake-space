import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useCreateSpace } from '@/ui/spaces/queries'

export function CreateSpaceDialog({
  onClose
}: {
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const [name, setName] = useState('')
  const create = useCreateSpace()
  const trimmed = name.trim()

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId}>
      <form
        onSubmit={event => {
          event.preventDefault()
          create.mutate(trimmed, { onSuccess: onClose })
        }}
      >
        <DialogTitle id={titleId}>{t('spaces.create')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            label={t('spaces.name')}
            value={name}
            onChange={event => {
              setName(event.target.value)
            }}
            slotProps={{ htmlInput: { maxLength: 255 } }}
          />
          {create.isError && (
            <Alert severity="error">{t('spaces.createFailed')}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={trimmed === '' || create.isPending}
          >
            {t('common.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
