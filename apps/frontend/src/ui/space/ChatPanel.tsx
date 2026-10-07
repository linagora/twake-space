import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { EmbeddedAppFrame } from '@/ui/space/EmbeddedAppFrame'

// Twake Chat shows the conversation of the space's Matrix space (ADR 010):
// its own `/embed/rooms/` route, keyed by the room id. Its calls take the
// camera, the microphone and the screen, and the whole page while they last
// (`twake-embed:fullscreen`).
export function ChatPanel({
  spaceId,
  roomId,
  active = true
}: {
  spaceId: string
  roomId: string
  // Hidden on another tab of the space, kept alive
  active?: boolean
}): ReactElement {
  const { t } = useI18n()
  const { chatUrl } = useServices()
  if (!chatUrl) return <Typography>{t('chat.notSetUp')}</Typography>
  return (
    <EmbeddedAppFrame
      app="chat"
      appUrl={chatUrl}
      embedPath={`/embed/rooms/${encodeURIComponent(roomId)}`}
      tabPath={`/spaces/${spaceId}/chat`}
      title={t('tabs.chat')}
      allow="camera; microphone; display-capture"
      canFillPage
      active={active}
    />
  )
}
