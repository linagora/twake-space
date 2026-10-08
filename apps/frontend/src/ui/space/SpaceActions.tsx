import { Assistant, Icon, PersonAdd } from '@linagora/twake-icons'
import { IconButton } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import type { Space } from '@/application/spaces'
import { useAssistant } from '@/ui/assistant/AssistantPanel'
import { MeetingMenu } from '@/ui/call/MeetingMenu'
import { useI18n } from '@/ui/i18n/useI18n'
import { PeopleDialog } from '@/ui/space/PeopleDialog'
import { ShareLinkButton, SpaceMenu } from '@/ui/space/SpaceMenu'

// The header's actions: the assistant, invite (admins), video meetings,
// share the link, and the rest in the menu. The mockup's call waits for its
// app.
export function SpaceActions({ space }: { space: Space }): ReactElement {
  const { t } = useI18n()
  const [inviting, setInviting] = useState(false)
  const assistant = useAssistant()
  return (
    <>
      <IconButton
        aria-label={t('assistant.open')}
        aria-pressed={assistant.open}
        onClick={() => {
          assistant.setOpen(!assistant.open)
        }}
      >
        <Icon icon={Assistant} />
      </IconButton>
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
      <MeetingMenu />
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
