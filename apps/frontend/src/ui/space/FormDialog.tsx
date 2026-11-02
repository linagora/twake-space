import { Icon, Plus } from '@linagora/twake-icons'
import {
  Button,
  Dialog,
  DialogActions,
  Divider,
  Stack,
  TextField
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState, type ReactElement } from 'react'

import {
  FORM_FIELDS,
  FORM_LABEL,
  POLL_OPTIONS,
  type FeedItem
} from '@/application/feed'
import {
  DialogCheckbox,
  DialogFields,
  DialogHeader,
  DialogSection
} from '@/ds/Dialog'
import { FeedPollOption } from '@/ds/Feed'
import { FormIcon } from '@/ds/icons'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { FeedFailure } from '@/ui/space/FeedFailure'

// `key` keeps a field in place when one above it is removed.
interface Question {
  key: number
  label: string
  // Null for a text answer.
  options: { key: number; text: string }[] | null
}

/** A new form: a title and up to ten questions, answered in text or by a choice. */
export function FormDialog({
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
  const nameId = useId()
  const nextKey = useRef(1)
  const newKey = () => {
    nextKey.current += 1
    return nextKey.current
  }
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([
    { key: 0, label: '', options: null }
  ])
  const [anonymous, setAnonymous] = useState(false)
  const update = (key: number, change: (question: Question) => Question) => {
    setQuestions(current => current.map(q => (q.key === key ? change(q) : q)))
  }
  const fields = questions.map(question => {
    const label = question.label.trim()
    if (!question.options) return { label, kind: 'text' as const }
    const options = question.options.map(o => o.text.trim()).filter(Boolean)
    return { label, kind: 'choice' as const, options }
  })
  const valid =
    title.trim() !== '' &&
    fields.every(
      field =>
        field.label !== '' &&
        (field.kind === 'text' ||
          (field.options.length >= POLL_OPTIONS.min &&
            new Set(field.options.map(o => o.toLowerCase())).size ===
              field.options.length))
    )
  const publish = useMutation({
    mutationFn: () =>
      feed.post(spaceId, title.trim(), [], { form: { fields, anonymous } }),
    onSuccess: onPublished
  })
  const add = (choice: boolean) => {
    setQuestions(current => [
      ...current,
      {
        key: newKey(),
        label: '',
        options: choice
          ? Array.from({ length: POLL_OPTIONS.min }, () => ({
              key: newKey(),
              text: ''
            }))
          : null
      }
    ])
  }

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
          title={t('feed.form.title')}
          subtitle={t('feed.form.subtitle')}
          icon={<Icon icon={FormIcon} size={20} />}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <Divider />
        <DialogFields>
          <DialogSection label={t('feed.form.name')} htmlFor={nameId}>
            <TextField
              id={nameId}
              fullWidth
              required
              placeholder={t('feed.form.namePlaceholder')}
              value={title}
              slotProps={{ htmlInput: { maxLength: 4000 } }}
              onChange={event => {
                setTitle(event.target.value)
              }}
            />
          </DialogSection>
          {questions.map((question, index) => {
            const n = index + 1
            return (
              <DialogSection
                key={question.key}
                label={t(
                  question.options
                    ? 'feed.form.choiceQuestion'
                    : 'feed.form.textQuestion',
                  { n }
                )}
              >
                <FeedPollOption
                  removeLabel={t('feed.form.removeQuestion', { n })}
                  onRemove={
                    questions.length > 1
                      ? () => {
                          setQuestions(current =>
                            current.filter(q => q.key !== question.key)
                          )
                        }
                      : null
                  }
                >
                  <TextField
                    fullWidth
                    placeholder={t('feed.form.question', { n })}
                    value={question.label}
                    slotProps={{
                      htmlInput: {
                        maxLength: FORM_LABEL.max,
                        'aria-label': t('feed.form.question', { n })
                      }
                    }}
                    onChange={event => {
                      const label = event.target.value
                      update(question.key, q => ({ ...q, label }))
                    }}
                  />
                </FeedPollOption>
                {question.options && (
                  <Stack spacing={1}>
                    {question.options.map((option, optionIndex) => {
                      const m = optionIndex + 1
                      return (
                        <FeedPollOption
                          key={option.key}
                          removeLabel={t('feed.form.removeOption', { n, m })}
                          onRemove={
                            (question.options?.length ?? 0) > POLL_OPTIONS.min
                              ? () => {
                                  update(question.key, q => ({
                                    ...q,
                                    options:
                                      q.options?.filter(
                                        o => o.key !== option.key
                                      ) ?? null
                                  }))
                                }
                              : null
                          }
                        >
                          <TextField
                            fullWidth
                            size="small"
                            placeholder={t('feed.poll.option', { n: m })}
                            value={option.text}
                            slotProps={{
                              htmlInput: {
                                maxLength: 200,
                                'aria-label': t('feed.form.option', { n, m })
                              }
                            }}
                            onChange={event => {
                              const text = event.target.value
                              update(question.key, q => ({
                                ...q,
                                options:
                                  q.options?.map(o =>
                                    o.key === option.key ? { ...o, text } : o
                                  ) ?? null
                              }))
                            }}
                          />
                        </FeedPollOption>
                      )
                    })}
                    {question.options.length < POLL_OPTIONS.max && (
                      <div>
                        <Button
                          variant="text"
                          size="small"
                          startIcon={<Icon icon={Plus} size={16} />}
                          onClick={() => {
                            const key = newKey()
                            update(question.key, q => ({
                              ...q,
                              options: [...(q.options ?? []), { key, text: '' }]
                            }))
                          }}
                        >
                          {t('feed.poll.addOption')}
                        </Button>
                      </div>
                    )}
                  </Stack>
                )}
              </DialogSection>
            )
          })}
          {questions.length < FORM_FIELDS.max && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="text"
                size="small"
                startIcon={<Icon icon={Plus} size={16} />}
                onClick={() => {
                  add(false)
                }}
              >
                {t('feed.form.addText')}
              </Button>
              <Button
                variant="text"
                size="small"
                startIcon={<Icon icon={Plus} size={16} />}
                onClick={() => {
                  add(true)
                }}
              >
                {t('feed.form.addChoice')}
              </Button>
            </Stack>
          )}
          <DialogCheckbox
            label={t('feed.form.anonymous')}
            description={t('feed.form.anonymousHint')}
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
            disabled={!valid || publish.isPending}
          >
            {t('feed.form.publish')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
