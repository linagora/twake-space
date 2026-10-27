import { Icon } from '@linagora/twake-icons'
import {
  Button,
  Dialog,
  DialogActions,
  Divider,
  TextField
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import { useId, useState, type ReactElement } from 'react'

import { ANNOUNCEMENT_TITLE, type FeedItem } from '@/application/feed'
import { DialogFields, DialogHeader, DialogSection } from '@/ds/Dialog'
import { ANNOUNCEMENT_DEFAULT_COLOR, AnnouncementBannerField } from '@/ds/Feed'
import { CampaignIcon } from '@/ds/icons'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { FeedFailure } from '@/ui/space/FeedFailure'

/** A new announcement, pinned once published, for everyone to acknowledge. */
export function AnnouncementDialog({
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
  const textId = useId()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [color, setColor] = useState<string | null>(ANNOUNCEMENT_DEFAULT_COLOR)
  const publish = useMutation({
    mutationFn: () =>
      feed.post(spaceId, text.trim(), [], {
        announcement: {
          ...(title.trim() && { title: title.trim() }),
          ...(color && { color })
        }
      }),
    onSuccess: onPublished
  })

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="medium">
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault()
          if (text.trim()) publish.mutate()
        }}
      >
        <DialogHeader
          id={titleId}
          title={t('feed.announcement.title')}
          subtitle={t('feed.announcement.subtitle')}
          icon={<Icon icon={CampaignIcon} size={20} />}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <Divider />
        <AnnouncementBannerField
          title={title}
          onTitle={setTitle}
          placeholder={t('feed.announcement.headline')}
          label={t('feed.announcement.headlineLabel')}
          maxLength={ANNOUNCEMENT_TITLE.max}
          color={color}
          onColor={setColor}
          colors={{
            label: t('feed.announcement.color'),
            none: t('feed.announcement.noColor'),
            custom: t('feed.announcement.customColor'),
            color: hex => t('feed.announcement.colorName', { hex })
          }}
        />
        <DialogFields>
          <DialogSection label={t('feed.announcement.text')} htmlFor={textId}>
            <TextField
              id={textId}
              fullWidth
              multiline
              minRows={3}
              maxRows={12}
              placeholder={t('feed.announcement.placeholder')}
              value={text}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              onChange={event => {
                setText(event.target.value)
              }}
            />
            <FeedFailure error={publish.error} message={t('feed.postFailed')} />
          </DialogSection>
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
            {t('feed.announcement.publish')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
