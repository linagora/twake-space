import { CrossMedium, Icon, Pen } from '@linagora/twake-icons'
import {
  Alert,
  IconButton,
  Typography,
  useColorScheme
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement
} from 'react'

import {
  ASSISTANT_INTENT,
  assistantService,
  parseAssistantMessage,
  type AssistantConfig,
  type AssistantService
} from '@/application/assistant'
import type { Sdk, SdkStatus } from '@linagora/twake-sdk'

import { EmbedFrame } from '@/ds/EmbedFrame'
import { LoadingRows } from '@/ds/Page'
import { SidePanel } from '@/ds/Panel'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useSession } from '@/ui/session/SessionGate'
import { useFeedCache } from '@/ui/space/feedQueries'

// Whether the assistant's panel is open, for the shell that shows it and
// the header that toggles it. Outside the shell the button does nothing.
export const AssistantContext = createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({ open: false, setOpen: () => undefined })

export function useAssistant(): {
  open: boolean
  setOpen: (o: boolean) => void
} {
  return use(AssistantContext)
}

// Twake Assistant as the scribe of a space: its answers can be posted in
// the space's feed. The mockup's history waits for the assistant's API.
export function AssistantPanel({
  spaceId,
  onClose
}: {
  spaceId: string
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  // A new conversation is a new intent: the frame is replaced.
  const [conversation, setConversation] = useState(0)
  return (
    <SidePanel
      title={t('assistant.title')}
      actions={
        <>
          <IconButton
            size="small"
            aria-label={t('assistant.newConversation')}
            onClick={() => {
              setConversation(n => n + 1)
            }}
          >
            <Icon icon={Pen} />
          </IconButton>
          <IconButton
            size="small"
            aria-label={t('assistant.close')}
            onClick={onClose}
          >
            <Icon icon={CrossMedium} />
          </IconButton>
        </>
      }
    >
      <Conversation key={conversation} spaceId={spaceId} />
    </SidePanel>
  )
}

// The platform's client: `waiting` while its token is exchanged, `public`
// when the user has no platform or the exchange failed.
function useSdkStatus(sdk: Sdk | null): SdkStatus {
  return useSyncExternalStore(
    listener => (sdk ? sdk.onStatusChange(listener) : () => undefined),
    () => sdk?.status ?? 'public'
  )
}

function Conversation({ spaceId }: { spaceId: string }): ReactElement {
  const { t } = useI18n()
  const { sdk } = useSession()
  const status = useSdkStatus(sdk)
  const ready = status === 'ready' ? sdk : null
  const { feed } = useServices()
  const { add } = useFeedCache(spaceId)
  const { colorScheme } = useColorScheme()
  const frame = useRef<HTMLIFrameElement>(null)
  // An intent serves one frame: this conversation's, for as long as it shows.
  const [intent, setIntent] = useState<
    | { status: 'pending' }
    | { status: 'failed' }
    | { status: 'ready'; service: AssistantService | null }
  >({ status: 'pending' })
  useEffect(() => {
    if (!ready) return
    let shown = true
    ready.createIntent(ASSISTANT_INTENT).then(
      created => {
        if (shown) {
          setIntent({ status: 'ready', service: assistantService(created) })
        }
      },
      (error: unknown) => {
        console.error('Assistant intent failed:', error)
        if (shown) setIntent({ status: 'failed' })
      }
    )
    return () => {
      shown = false
    }
  }, [ready])
  const service = intent.status === 'ready' ? intent.service : null
  const post = useMutation({
    mutationFn: (text: string) => feed.post(spaceId, text),
    onSuccess: add
  })
  const { mutate } = post
  const postLabel = t('assistant.post')
  const theme =
    colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : null

  useEffect(() => {
    if (!service) return
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== service.origin) return
      const message = parseAssistantMessage(event.data, service.intentId)
      if (message?.kind === 'ready') {
        const config: AssistantConfig = {
          answerActions: [{ name: 'post', label: postLabel }],
          ...(theme && { theme: { type: theme } })
        }
        frame.current?.contentWindow?.postMessage(config, service.origin)
      } else if (
        message?.kind === 'result' &&
        message.result.answerAction === 'post'
      ) {
        mutate(message.result.text)
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [service, postLabel, theme, mutate])

  if (status === 'public') {
    return <Typography className="u-p-1">{t('assistant.notSetUp')}</Typography>
  }
  if (intent.status === 'pending') {
    return (
      <div className="u-p-1">
        <LoadingRows count={3} label={t('assistant.loading')} />
      </div>
    )
  }
  if (!service) {
    return (
      <Alert severity="error" className="u-m-1">
        {t('assistant.failed')}
      </Alert>
    )
  }
  return (
    <>
      {post.isError && (
        <Alert severity="error" className="u-m-1">
          {t('assistant.postFailed')}
        </Alert>
      )}
      <EmbedFrame
        frameRef={frame}
        src={service.href}
        title={t('assistant.title')}
        allow="clipboard-write"
      />
    </>
  )
}
