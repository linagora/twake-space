import { Icon, StarOutline } from '@linagora/twake-icons'
import {
  Button,
  Dialog,
  DialogActions,
  Divider,
  TextField
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import { useId, useState, type ReactElement } from 'react'

import type { FeedItem } from '@/application/feed'
import {
  DialogCheckbox,
  DialogFields,
  DialogHeader,
  DialogSection
} from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { FeedFailure } from '@/ui/space/FeedFailure'

/** A new feedback request: a question to rate, its answers named or not. */
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
  const questionId = useId()
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const publish = useMutation({
    mutationFn: () =>
      feed.post(spaceId, text.trim(), [], { feedback: { anonymous } }),
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
          subtitle={t('feed.feedback.subtitle')}
          icon={<Icon icon={StarOutline} size={18} />}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <Divider />
        <DialogFields>
          <DialogSection label={t('feed.feedback.text')} htmlFor={questionId}>
            <TextField
              id={questionId}
              fullWidth
              multiline
              maxRows={6}
              required
              placeholder={t('feed.feedback.placeholder')}
              value={text}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              onChange={event => {
                setText(event.target.value)
              }}
            />
          </DialogSection>
          <DialogCheckbox
            label={t('feed.feedback.anonymous')}
            description={t('feed.feedback.anonymousHint')}
            checked={anonymous}
            onChange={setAnonymous}
          />
          <FeedFailure error={publish.error} message={t('feed.postFailed')} />
        </DialogFields>
        <Divider />
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
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
