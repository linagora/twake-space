import { useColorScheme } from '@linagora/twake-mui'
import { useEffect, useMemo } from 'react'

import type { FeedbackLabels } from '@/application/feedback'
import '@/ds/feedbackWidget.css'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

// Shows Sentry's floating feedback button while the calling shell is mounted.
export function useFeedbackButton(): void {
  const { feedback } = useServices()
  const { t, lang } = useI18n()
  const { colorScheme = 'system' } = useColorScheme()

  // `t` changes with the language only.
  const labels = useMemo<FeedbackLabels>(
    () => ({
      triggerLabel: t('feedback.triggerLabel'),
      triggerAriaLabel: t('feedback.triggerAriaLabel'),
      formTitle: t('feedback.formTitle'),
      messageLabel: t('feedback.messageLabel'),
      messagePlaceholder: t('feedback.messagePlaceholder'),
      emailLabel: t('feedback.emailLabel'),
      emailPlaceholder: t('feedback.emailPlaceholder'),
      submitButtonLabel: t('feedback.submitButtonLabel'),
      cancelButtonLabel: t('feedback.cancelButtonLabel'),
      confirmButtonLabel: t('feedback.confirmButtonLabel'),
      successMessageText: t('feedback.successMessageText'),
      isRequiredLabel: t('feedback.isRequiredLabel'),
      addScreenshotButtonLabel: t('feedback.addScreenshotButtonLabel'),
      removeScreenshotButtonLabel: t('feedback.removeScreenshotButtonLabel'),
      highlightToolText: t('feedback.highlightToolText'),
      hideToolText: t('feedback.hideToolText'),
      removeHighlightText: t('feedback.removeHighlightText'),
      errorEmptyMessageText: t('feedback.errorEmptyMessageText'),
      errorNoClientText: t('feedback.errorNoClientText'),
      errorTimeoutText: t('feedback.errorTimeoutText'),
      errorForbiddenText: t('feedback.errorForbiddenText'),
      errorGenericText: t('feedback.errorGenericText')
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang]
  )

  useEffect(
    () => feedback?.mount(labels, colorScheme),
    [feedback, labels, colorScheme]
  )
}
