import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { driveUrl } from '@/application/drive'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useSession } from '@/ui/session/SessionGate'
import { EmbeddedAppFrame } from '@/ui/space/EmbeddedAppFrame'

// Twake Drive's embed of a shared drive, opened from its sharing id alone.
// Placeholder until Twake Drive publishes the route.
const SHARING_EMBED = '/embed/sharings/'

export function DrivePanel({
  spaceId,
  sharingId,
  active = true
}: {
  spaceId: string
  sharingId: string
  // Hidden on another tab of the space, kept alive
  active?: boolean
}): ReactElement {
  const { t } = useI18n()
  const { driveUrlTemplate } = useServices()
  const { user } = useSession()
  const url = driveUrl(driveUrlTemplate, user.workplaceFqdn)
  if (!url) return <Typography>{t('drive.notSetUp')}</Typography>
  return (
    <EmbeddedAppFrame
      app="drive"
      appUrl={url}
      embedPath={`${SHARING_EMBED}${encodeURIComponent(sharingId)}`}
      tabPath={`/spaces/${spaceId}/drive`}
      title={t('tabs.drive')}
      active={active}
    />
  )
}
