import { SdkProvider, TwakeBar } from '@linagora/twake-bar'
import type { ReactElement } from 'react'

import spaceIcon from '@/assets/space.svg'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'

/**
 * The platform top bar: home, the other apps and the account. Shown once the
 * SSO named the user's platform, which exchanges the id token for its own.
 */
export function PlatformBar(): ReactElement | null {
  const { t } = useI18n()
  const { sdk, signOut } = useSession()
  if (!sdk) return null

  return (
    <SdkProvider client={sdk}>
      <TwakeBar
        app={{
          slug: 'space',
          name: t('app.name'),
          icon: new URL(spaceIcon, window.location.origin).href
        }}
        onLogOut={() => void signOut()}
      />
    </SdkProvider>
  )
}
