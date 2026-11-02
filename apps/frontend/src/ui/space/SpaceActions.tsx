import { Assistant, Icon } from '@linagora/twake-icons'
import { useBreakpoints } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import type { Space } from '@/application/spaces'
import { IconButton } from '@/ds/IconButton'
import { GroupAddIcon } from '@/ds/icons'
import { MenuSheet, menuEntries } from '@/ds/Menu'
import { useAssistant } from '@/ui/assistant/AssistantPanel'
import { MeetingMenu, useMeetingActions } from '@/ui/call/MeetingMenu'
import { useI18n } from '@/ui/i18n/useI18n'
import { PeopleDialog } from '@/ui/space/PeopleDialog'
import {
  ShareLinkButton,
  SpaceMenu,
  SpaceMenuButton,
  useSpaceMenu
} from '@/ui/space/SpaceMenu'

// The header's actions, in the mockup's order: the assistant, video meetings,
// invite (admins), share the link, and the rest in the menu. The mockup's
// call waits for its app. On a phone, only invite stays in the header and
// the rest is in the menu's sheet.
export function SpaceActions({ space }: { space: Space }): ReactElement {
  const { t } = useI18n()
  const [inviting, setInviting] = useState(false)
  const assistant = useAssistant()
  const { isMobile } = useBreakpoints()
  return (
    <>
      {!isMobile && (
        <>
          <IconButton
            size="small"
            label={t('assistant.open')}
            aria-pressed={assistant.open}
            onClick={() => {
              assistant.setOpen(!assistant.open)
            }}
          >
            <Icon icon={Assistant} />
          </IconButton>
          <MeetingMenu space={space} />
        </>
      )}
      {space.role === 'admin' && (
        <IconButton
          size="small"
          label={t('spaceMenu.invite')}
          onClick={() => {
            setInviting(true)
          }}
        >
          <Icon icon={GroupAddIcon} />
        </IconButton>
      )}
      {isMobile ? (
        <SpaceActionSheet space={space} />
      ) : (
        <>
          <ShareLinkButton id={space.id} />
          <SpaceMenu space={space} />
        </>
      )}
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

function SpaceActionSheet({ space }: { space: Space }): ReactElement {
  const { t } = useI18n()
  const assistant = useAssistant()
  const meeting = useMeetingActions(space)
  const menu = useSpaceMenu(space)
  const [open, setOpen] = useState(false)
  const close = (): void => {
    setOpen(false)
  }
  const [first = [], ...rest] = menu.groups
  return (
    <>
      <SpaceMenuButton
        name={space.name}
        open={open}
        onClick={() => {
          setOpen(true)
        }}
      />
      {open && (
        <MenuSheet
          label={t('spaceMenu.open', { name: space.name })}
          onClose={close}
        >
          {menuEntries(
            [
              [
                {
                  key: 'assistant',
                  icon: Assistant,
                  label: t('assistant.open'),
                  onClick: () => {
                    assistant.setOpen(!assistant.open)
                  }
                },
                ...meeting.actions,
                ...first
              ],
              ...rest
            ],
            close
          )}
        </MenuSheet>
      )}
      {meeting.dialogs}
      {menu.dialogs}
    </>
  )
}
