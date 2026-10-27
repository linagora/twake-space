import { Icon, Plus } from '@linagora/twake-icons'
import {
  Button,
  Dialog,
  DialogActions,
  Divider,
  TextField
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState, type ReactElement } from 'react'

import { POLL_OPTIONS, type FeedItem, type Poll } from '@/application/feed'
import {
  DialogFields,
  DialogHeader,
  DialogSection,
  DialogSwitch
} from '@/ds/Dialog'
import { FeedPollOption } from '@/ds/Feed'
import { PollIcon } from '@/ds/icons'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { FeedFailure } from '@/ui/space/FeedFailure'

// `key` keeps a field in place when one above it is removed.
interface OptionField {
  key: number
  text: string
}

/** A new poll: a question and different options to pick from, or a yes/no question. */
export function PollDialog({
  spaceId,
  kind,
  onClose,
  onPublished
}: {
  spaceId: string
  kind: Poll['kind']
  onClose: () => void
  onPublished: (item: FeedItem) => void
}): ReactElement {
  const { t } = useI18n()
  const { feed } = useServices()
  const titleId = useId()
  const questionId = useId()
  const nextKey = useRef(POLL_OPTIONS.min)
  const [question, setQuestion] = useState('')
  const [fields, setFields] = useState<OptionField[]>(() =>
    Array.from({ length: POLL_OPTIONS.min }, (_, key) => ({ key, text: '' }))
  )
  const [multiple, setMultiple] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const options = fields.map(field => field.text.trim()).filter(Boolean)
  const valid =
    question.trim() !== '' &&
    (kind === 'yes_no' ||
      (options.length >= POLL_OPTIONS.min &&
        new Set(options.map(o => o.toLowerCase())).size === options.length))
  const publish = useMutation({
    mutationFn: () =>
      feed.post(
        spaceId,
        question.trim(),
        [],
        kind === 'yes_no'
          ? { poll: { kind } }
          : { poll: { options, multiple, anonymous } }
      ),
    onSuccess: onPublished
  })

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="medium">
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault()
          if (valid) publish.mutate()
        }}
      >
        <DialogHeader
          id={titleId}
          title={t(kind === 'yes_no' ? 'feed.yesNo.title' : 'feed.poll.title')}
          {...(kind === 'choice' && { subtitle: t('feed.poll.subtitle') })}
          icon={<PollIcon width={20} height={20} />}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <Divider />
        <DialogFields>
          <DialogSection label={t('feed.poll.question')} htmlFor={questionId}>
            <TextField
              id={questionId}
              fullWidth
              {...(kind === 'choice' && {
                placeholder: t('feed.poll.questionPlaceholder')
              })}
              value={question}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              onChange={event => {
                setQuestion(event.target.value)
              }}
            />
          </DialogSection>
          {kind === 'choice' && (
            <>
              <DialogSection label={t('feed.poll.options')}>
                {fields.map((field, index) => (
                  <FeedPollOption
                    key={field.key}
                    removeLabel={t('feed.poll.removeOption', { n: index + 1 })}
                    onRemove={
                      fields.length > POLL_OPTIONS.min
                        ? () => {
                            setFields(current =>
                              current.filter(f => f.key !== field.key)
                            )
                          }
                        : null
                    }
                  >
                    <TextField
                      fullWidth
                      placeholder={t('feed.poll.option', { n: index + 1 })}
                      value={field.text}
                      slotProps={{
                        htmlInput: {
                          maxLength: 200,
                          'aria-label': t('feed.poll.option', { n: index + 1 })
                        }
                      }}
                      onChange={event => {
                        const text = event.target.value
                        setFields(current =>
                          current.map(f =>
                            f.key === field.key ? { ...f, text } : f
                          )
                        )
                      }}
                    />
                  </FeedPollOption>
                ))}
                {fields.length < POLL_OPTIONS.max && (
                  <div>
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<Icon icon={Plus} size={16} />}
                      onClick={() => {
                        const key = nextKey.current
                        nextKey.current += 1
                        setFields(current => [...current, { key, text: '' }])
                      }}
                    >
                      {t('feed.poll.addOption')}
                    </Button>
                  </div>
                )}
              </DialogSection>
              <div>
                <DialogSwitch
                  label={t('feed.poll.multiple')}
                  checked={multiple}
                  onChange={setMultiple}
                />
                <DialogSwitch
                  label={t('feed.poll.anonymous')}
                  checked={anonymous}
                  onChange={setAnonymous}
                />
              </div>
            </>
          )}
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
            disabled={!valid || publish.isPending}
          >
            {t(kind === 'yes_no' ? 'feed.yesNo.publish' : 'feed.poll.publish')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
