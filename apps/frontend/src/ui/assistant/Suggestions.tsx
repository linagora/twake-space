import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import type { Suggestion } from '@/application/suggestions'
import { SuggestionCard, SuggestionStack } from '@/ds/SuggestionCard'
import { useAnswer, useSuggestions } from '@/ui/assistant/queries'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

// The assistant's proposals, top right, until the user answers or closes them.
export function Suggestions(): ReactElement | null {
  const { t } = useI18n()
  const suggestions = useSuggestions().data ?? []
  if (suggestions.length === 0) return null

  return (
    <SuggestionStack label={t('suggestions.title')}>
      {suggestions.map(suggestion => (
        <SuggestionItem key={suggestion.id} suggestion={suggestion} />
      ))}
    </SuggestionStack>
  )
}

function SuggestionItem({
  suggestion
}: {
  suggestion: Suggestion
}): ReactElement {
  const { t } = useI18n()
  const { harness } = useServices()
  const answer = useAnswer(suggestion)
  const answers = [
    ['approve', t('suggestions.create'), 'contained'],
    ['another_time', t('suggestions.anotherTime'), 'outlined'],
    ['not_useful', t('suggestions.notUseful'), 'text']
  ] as const

  return (
    <SuggestionCard
      text={suggestion.text}
      close={{
        label: t('common.close'),
        onClick: () => {
          answer.mutate('close')
        }
      }}
      error={answer.isError ? t('suggestions.failed') : null}
      actions={
        harness &&
        answers.map(([value, label, variant]) => (
          <Button
            key={value}
            size="small"
            variant={variant}
            disabled={answer.isPending}
            onClick={() => {
              answer.mutate(value)
            }}
          >
            {label}
          </Button>
        ))
      }
    />
  )
}
