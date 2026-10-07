import { FeedbackButton, getFeedbackLabels } from '@linagora/twake-feedback'
import { useColorScheme, useMediaQuery, useTheme } from '@linagora/twake-mui'
import { useCallback, useEffect, type ReactElement } from 'react'

import type { FeedbackService } from '@/application/feedback'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

// Height of the bottom bar the sidebar becomes below lg (--sidebarHeight).
const MOBILE_BAR_HEIGHT = 52

// The draggable feedback button, when feedback is on.
export function AppFeedback(): ReactElement | null {
  const { feedback } = useServices()

  return feedback?.enabled === true ? <Button feedback={feedback} /> : null
}

function Button({ feedback }: { feedback: FeedbackService }): ReactElement {
  const { lang } = useI18n()
  const theme = useTheme()
  const bottomBar = useMediaQuery(theme.breakpoints.down('lg'))
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
      bottomOffset={bottomBar ? MOBILE_BAR_HEIGHT : 0}
    />
  )
}
