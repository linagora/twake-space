import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { EmbeddedAppFrame } from '@/ui/space/EmbeddedAppFrame'

// Twake Mail serves the overlay its composer and dialogs go onto.
const MAIL_OVERLAY = '/embed/overlay.html'

export function MailPanel({
  spaceId,
  mailboxId
}: {
  spaceId: string
  mailboxId: string
}): ReactElement {
  const { t } = useI18n()
  const { mailUrl } = useServices()
  if (!mailUrl) return <Typography>{t('mail.notSetUp')}</Typography>
  return (
    <EmbeddedAppFrame
      app="mail"
      appUrl={mailUrl}
      embedPath={`/embed/team-mailboxes/${encodeURIComponent(mailboxId)}`}
      tabPath={`/spaces/${spaceId}/mail`}
      title={t('tabs.mail')}
      overlayPath={MAIL_OVERLAY}
    />
  )
}
