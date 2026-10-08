import { Icon, Link } from '@linagora/twake-icons'
import { IconButton, Menu } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { tabPath } from '@/application/embeddedApps'
import type { Space } from '@/application/spaces'
import { isTabReady } from '@/application/spaceTabs'
import { Videocam } from '@/ds/icons'
import { MenuEntry } from '@/ds/Menu'
import { useCall } from '@/ui/call/CallContext'
import { JoinMeetingDialog } from '@/ui/call/JoinMeetingDialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useAppUrls } from '@/ui/space/useAppUrls'

// The space header's video button.
export function MeetingMenu({ space }: { space: Space }): ReactElement | null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { meetUrl } = useServices()
  const appUrls = useAppUrls()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [joining, setJoining] = useState(false)
  const { leave } = useCall()
  const chatCall = appUrls.chat !== null && isTabReady(space, 'chat')
  if (!meetUrl && !chatCall) return null
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
        {chatCall && (
          <MenuEntry
            icon={<Icon icon={Videocam} />}
            onClick={() => {
              close()
              // One call at a time: the Meet room is left for Chat's call
              leave()
              void navigate(`${tabPath(space.id, 'chat')}?call=start`)
            }}
          >
            {t('call.start')}
          </MenuEntry>
        )}
        {meetUrl && (
          <MenuEntry
            icon={<Icon icon={Link} />}
            onClick={() => {
              close()
              setJoining(true)
            }}
          >
            {t('call.join')}
          </MenuEntry>
        )}
      </Menu>
      {joining && meetUrl && (
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
