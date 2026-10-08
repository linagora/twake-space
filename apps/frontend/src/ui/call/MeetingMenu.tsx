import { Icon, Link } from '@linagora/twake-icons'
import { IconButton, Menu } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { Videocam } from '@/ds/icons'
import { MenuEntry } from '@/ds/Menu'
import { JoinMeetingDialog } from '@/ui/call/JoinMeetingDialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

// The space header's video button.
export function MeetingMenu(): ReactElement | null {
  const { t } = useI18n()
  const { meetUrl } = useServices()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [joining, setJoining] = useState(false)
  if (!meetUrl) return null
  const close = (): void => {
    setAnchor(null)
  }
  return (
    <>
      <IconButton
        aria-label={t('call.menu')}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
      >
        <Icon icon={Videocam} />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        <MenuEntry
          icon={<Icon icon={Link} />}
          onClick={() => {
            close()
            setJoining(true)
          }}
        >
          {t('call.join')}
        </MenuEntry>
      </Menu>
      {joining && (
        <JoinMeetingDialog
          meetUrl={meetUrl}
          onClose={() => {
            setJoining(false)
          }}
        />
      )}
    </>
  )
}
