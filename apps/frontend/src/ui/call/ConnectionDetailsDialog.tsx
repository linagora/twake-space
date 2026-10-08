import { Copy, Icon } from '@linagora/twake-icons'
import {
  Dialog,
  DialogContent,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useId, useRef, useState, type ReactElement } from 'react'

import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'

export function ConnectionDetailsDialog({
  link,
  onClose
}: {
  link: string
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <DialogHeader
        id={titleId}
        title={t('call.details')}
        close={{ label: t('common.close'), onClick: onClose }}
      />
      <DialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} className="u-flex-items-center">
            <TextField
              fullWidth
              label={t('call.link')}
              value={link}
              inputRef={input}
              slotProps={{ htmlInput: { readOnly: true } }}
            />
            <IconButton
              aria-label={t('call.copyLink')}
              onClick={() => {
                // The clipboard API is missing on an insecure origin and may be
                // denied: selecting the link then leaves the user one Ctrl+C away.
                Promise.resolve()
                  .then(() => navigator.clipboard.writeText(link))
                  .then(
                    () => {
                      setCopied(true)
                    },
                    () => {
                      input.current?.select()
                    }
                  )
              }}
            >
              <Icon icon={Copy} />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="textSecondary">
            {t('call.share')}
          </Typography>
        </Stack>
      </DialogContent>
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => {
          setCopied(false)
        }}
        message={t('call.linkCopied')}
      />
    </Dialog>
  )
}
