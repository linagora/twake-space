import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import { useId, useState, type ReactElement } from 'react'

import type { FeedItem } from '@/application/feed'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { FeedFailure } from '@/ui/space/FeedFailure'

/** A new feedback request. */
export function TextPostDialog({
  spaceId,
  onClose,
  onPublished
}: {
  spaceId: string
  onClose: () => void
  onPublished: (item: FeedItem) => void
}): ReactElement {
  const { t } = useI18n()
  const { feed } = useServices()
  const titleId = useId()
  const [text, setText] = useState('')
  const publish = useMutation({
    mutationFn: () => feed.post(spaceId, text.trim(), [], { feedback: true }),
    onSuccess: onPublished
  })

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault()
          if (text.trim()) publish.mutate()
        }}
      >
        <DialogHeader
          id={titleId}
          title={t('feed.feedback.title')}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={12}
              label={t('feed.feedback.text')}
              helperText={t('feed.feedback.hint')}
              value={text}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              onChange={event => {
                setText(event.target.value)
              }}
            />
            <FeedFailure error={publish.error} message={t('feed.postFailed')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!text.trim() || publish.isPending}
          >
            {t('feed.feedback.publish')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
