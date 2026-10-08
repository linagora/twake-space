import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { meetRoomUrl } from '@/application/meet'
import { DialogHeader } from '@/ds/Dialog'
import { useCall } from '@/ui/call/CallContext'
import { useI18n } from '@/ui/i18n/useI18n'

export function JoinMeetingDialog({
  meetUrl,
  onClose
}: {
  meetUrl: string
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const { join } = useCall()
  const [link, setLink] = useState('')
  const [refused, setRefused] = useState(false)
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault()
          const url = meetRoomUrl(link, meetUrl)
          if (!url) {
            setRefused(true)
            return
          }
          join({ url })
          onClose()
        }}
      >
        <DialogHeader
          id={titleId}
          title={t('call.join')}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <DialogContent>
          <TextField
            fullWidth
            label={t('call.link')}
            value={link}
            error={refused}
            helperText={refused ? t('call.invalidLink') : t('call.linkHint')}
            onChange={event => {
              setLink(event.target.value)
              setRefused(false)
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={link.trim() === ''}
          >
            {t('call.joinAction')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
