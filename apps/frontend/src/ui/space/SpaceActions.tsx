import { Icon, PersonAdd } from '@linagora/twake-icons'
import { IconButton } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import type { Space } from '@/application/spaces'
import { useI18n } from '@/ui/i18n/useI18n'
import { PeopleDialog } from '@/ui/space/PeopleDialog'
import { ShareLinkButton, SpaceMenu } from '@/ui/space/SpaceMenu'

// The header's actions: invite (admins), share the link, and the rest in
// the menu. The mockup's assistant, call and video wait for their apps.
export function SpaceActions({ space }: { space: Space }): ReactElement {
  const { t } = useI18n()
  const [inviting, setInviting] = useState(false)
  return (
    <>
      {space.role === 'admin' && (
        <IconButton
          aria-label={t('spaceMenu.invite')}
          onClick={() => {
            setInviting(true)
          }}
        >
          <Icon icon={PersonAdd} />
        </IconButton>
      )}
      <ShareLinkButton id={space.id} />
      <SpaceMenu space={space} />
      {inviting && (
        <PeopleDialog
          space={space}
          onClose={() => {
            setInviting(false)
          }}
        />
      )}
    </>
  )
}
