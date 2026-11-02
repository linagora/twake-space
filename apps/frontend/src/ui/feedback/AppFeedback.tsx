import { FeedbackButton, getFeedbackLabels } from '@linagora/twake-feedback'
import { useColorScheme } from '@linagora/twake-mui'
import { useCallback, useEffect, type ReactElement } from 'react'
import { createPortal } from 'react-dom'

import type { FeedbackService } from '@/application/feedback'
import { useNarrowScreen } from '@/ds/AppFrame'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

// Room for a page's floating button below lg (PhoneFab): 56px and its edge.
const PHONE_FAB_ROOM = 72

// The draggable feedback button, when feedback is on.
export function AppFeedback(): ReactElement | null {
  const { feedback } = useServices()

  // On the body: an app's dialog makes #root inert, and a problem met in that
  // dialog must still be reportable
  return feedback?.enabled === true
    ? createPortal(<Button feedback={feedback} />, document.body)
    : null
}

function Button({ feedback }: { feedback: FeedbackService }): ReactElement {
  const { lang } = useI18n()
  const narrow = useNarrowScreen()
  const { colorScheme = 'system' } = useColorScheme()
  useEffect(() => {
    feedback.setColorScheme(colorScheme)
  }, [feedback, colorScheme])
  const attach = useCallback(
    (el: HTMLElement) => feedback.attach(el, getFeedbackLabels(lang)),
    [feedback, lang]
  )

  return (
    <FeedbackButton
      attach={attach}
      storageKey="twake-space"
      bottomOffset={narrow ? PHONE_FAB_ROOM : 0}
    />
  )
}
