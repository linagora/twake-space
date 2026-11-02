import { Calendar, Icon, Link } from '@linagora/twake-icons'
import { Menu, Snackbar } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { tabPath } from '@/application/embeddedApps'
import type { Space } from '@/application/spaces'
import { isTabReady } from '@/application/spaceTabs'
import { IconButton } from '@/ds/IconButton'
import { Videocam, VideocamSymbolIcon } from '@/ds/icons'
import { menuEntries, type MenuAction } from '@/ds/Menu'
import { useCall } from '@/ui/call/CallContext'
import { JoinMeetingDialog } from '@/ui/call/JoinMeetingDialog'
import { ScheduleMeetingDialog } from '@/ui/call/ScheduleMeetingDialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useAppUrls } from '@/ui/space/useAppUrls'

export function useMeetingActions(space: Space): {
  actions: MenuAction[]
  dialogs: ReactElement
} {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { meetUrl } = useServices()
  const appUrls = useAppUrls(space.chatUrl)
  const [joining, setJoining] = useState(false)
  const { leave } = useCall()
  const [scheduling, setScheduling] = useState(false)
  const [scheduled, setScheduled] = useState(false)
  const chatCall = appUrls.chat !== null && isTabReady(space, 'chat')
  const canSchedule = space.role !== 'viewer' && isTabReady(space, 'calendar')
  const actions: MenuAction[] = [
    ...(chatCall
      ? [
          {
            key: 'start',
            icon: Videocam,
            label: t('call.start'),
            onClick: () => {
              // One call at a time: the Meet room is left for Chat's call
              leave()
              void navigate(`${tabPath(space.id, 'chat')}?call=start`)
            }
          }
        ]
      : []),
    ...(canSchedule
      ? [
          {
            key: 'schedule',
            icon: Calendar,
            label: t('call.schedule'),
            onClick: () => {
              setScheduling(true)
            }
          }
        ]
      : []),
    ...(meetUrl
      ? [
          {
            key: 'join',
            icon: Link,
            label: t('call.join'),
            onClick: () => {
              setJoining(true)
            }
          }
        ]
      : [])
  ]
  return {
    actions,
    dialogs: (
      <>
        {joining && meetUrl && (
          <JoinMeetingDialog
            meetUrl={meetUrl}
            onClose={() => {
              setJoining(false)
            }}
          />
        )}
        {scheduling && (
          <ScheduleMeetingDialog
            space={space}
            onClose={() => {
              setScheduling(false)
            }}
            onScheduled={() => {
              setScheduling(false)
              setScheduled(true)
            }}
          />
        )}
        <Snackbar
          open={scheduled}
          autoHideDuration={6000}
          onClose={() => {
            setScheduled(false)
          }}
          message={t('call.scheduled')}
        />
      </>
    )
  }
}

// The space header's video button.
export function MeetingMenu({ space }: { space: Space }): ReactElement | null {
  const { t } = useI18n()
  const { actions, dialogs } = useMeetingActions(space)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  if (actions.length === 0) return null
  const close = (): void => {
    setAnchor(null)
  }
  return (
    <>
      <IconButton
        size="small"
        label={t('call.menu')}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
      >
        <Icon icon={VideocamSymbolIcon} />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        {menuEntries([actions], close)}
      </Menu>
      {dialogs}
    </>
  )
}
