import {
  Alert,
  Button,
  Snackbar,
  Typography,
  useColorScheme
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode
} from 'react'
import { Link as RouterLink } from 'react-router'

import {
  ASSISTANT_INTENT,
  ASSISTANT_READY_TIMEOUT,
  parseAnswer,
  type AnswerResult,
  type AssistantConfig
} from '@/application/assistant'
import type { Sdk, SdkStatus } from '@linagora/twake-sdk'
import { Intents, type StartedIntent } from 'cozy-interapp'

import { AsideClosable } from '@/ds/AppFrame'
import { LoadingRows } from '@/ds/Page'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { useSession } from '@/ui/session/SessionGate'
import { useFeedCache } from '@/ui/space/feedQueries'
import { useSpace } from '@/ui/spaces/queries'

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

// The platform's client: `waiting` while its token is exchanged, `public`
// when the user has no platform or the exchange failed.
function useSdkStatus(sdk: Sdk | null): SdkStatus {
  return useSyncExternalStore(
    listener => (sdk ? sdk.onStatusChange(listener) : () => undefined),
    () => sdk?.status ?? 'public'
  )
}

export function AssistantPanel({
  spaceId,
  onClose
}: {
  spaceId: string
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const { feed } = useServices()
  const { add } = useFeedCache(spaceId)
  const [posted, setPosted] = useState(false)
  const post = useMutation({
    mutationFn: (text: string) => feed.post(spaceId, text, []),
    onSuccess: item => {
      add(item)
      setPosted(true)
    }
  })
  const { mutate } = post
  // While the space loads, the action stays: the feed refuses a viewer anyway
  const canPost = useSpace(spaceId).data?.role !== 'viewer'
  const postLabel = canPost ? t('assistant.post') : null
  const config = useMemo(
    () => ({
      answerActions:
        postLabel === null ? [] : [{ name: 'post', label: postLabel }]
    }),
    [postLabel]
  )
  const onResult = useCallback(
    (result: AnswerResult) => {
      if (result.answerAction === 'post') mutate(result.text)
    },
    [mutate]
  )

  return (
    <AssistantFrame config={config} onResult={onResult} onClose={onClose}>
      {post.isError && (
        <Alert severity="error" className="u-m-1">
          {t('assistant.postFailed')}
        </Alert>
      )}
      <Snackbar
        open={posted}
        autoHideDuration={5000}
        onClose={() => {
          setPosted(false)
        }}
        message={t('assistant.posted')}
        action={
          <Button
            variant="text"
            size="small"
            component={RouterLink}
            to={`/spaces/${spaceId}/feed`}
            onClick={() => {
              setPosted(false)
            }}
          >
            {t('assistant.openFeed')}
          </Button>
        }
      />
    </AssistantFrame>
  )
}

/**
 * Twake Assistant in a frame, sent `config` when it is ready. A null `config`
 * keeps it loading. `children` show above the frame.
 */
export function AssistantFrame({
  config,
  onResult,
  onClose,
  children
}: {
  config: Omit<AssistantConfig, 'theme'> | null
  onResult?: (result: AnswerResult) => void
  onClose: () => void
  children?: ReactNode
}): ReactElement {
  const { t } = useI18n()
  const { sdk } = useSession()
  const status = useSdkStatus(sdk)
  const ready = status === 'ready' ? sdk : null
  const { colorScheme } = useColorScheme()
  const container = useRef<HTMLDivElement>(null)
  const started = useRef<StartedIntent>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const theme =
    colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : null
  const full = useMemo<AssistantConfig | null>(
    () => config && { ...config, ...(theme && { theme: { type: theme } }) },
    [config, theme]
  )
  const opening = full !== null

  const answer = useEffectEvent((result: unknown) => {
    const answered = parseAnswer(result)
    // Not the result: warnings reach Sentry, and it holds the answer
    if (answered === null) console.warn('Assistant result ignored')
    else onResult?.(answered)
  })
  const end = useEffectEvent(onClose)
  const title = useEffectEvent(() => t('assistant.title'))
  // An intent serves one frame: this conversation's, for as long as it shows.
  useEffect(() => {
    const element = container.current
    if (!ready || !opening || !element) return
    const running = new Intents({ client: ready })
      .create(ASSISTANT_INTENT.action, ASSISTANT_INTENT.type)
      .start(element, {
        title: title(),
        className: 'u-w-100 u-flex-auto u-bdw-0',
        readyTimeout: ASSISTANT_READY_TIMEOUT,
        onServiceReady: () => {
          setState('ready')
        },
        onResult: answer
      })
    started.current = running
    running.then(
      () => {
        end()
      },
      (error: unknown) => {
        console.error('Assistant intent failed:', error)
        setState('failed')
      }
    )
    return () => {
      running.stop()
      started.current = null
    }
  }, [ready, opening])
  // Sent at its `ready`; once ready, the assistant takes new data as they come
  useEffect(() => {
    if (full) started.current?.sendData(full)
  }, [full, opening, ready])

  if (status === 'public') {
    return (
      <Unavailable onClose={onClose}>
        <Typography className="u-p-1">{t('assistant.notSetUp')}</Typography>
      </Unavailable>
    )
  }
  if (state === 'failed') {
    return (
      <Unavailable onClose={onClose}>
        <Alert severity="error" className="u-m-1">
          {t('assistant.failed')}
        </Alert>
      </Unavailable>
    )
  }
  // The frame loads hidden, under the loading rows, until the assistant is ready
  const loading = state === 'loading'
  return (
    <>
      {loading ? (
        <Unavailable onClose={onClose}>
          <div className="u-p-1">
            <LoadingRows count={3} label={t('assistant.loading')} />
          </div>
        </Unavailable>
      ) : (
        children
      )}
      {ready && opening && (
        <div
          ref={container}
          className={loading ? 'u-dn' : 'u-flex u-flex-column u-flex-auto'}
        />
      )}
    </>
  )
}

// Without the embedded assistant and its own close, the panel brings one
function Unavailable({
  onClose,
  children
}: {
  onClose: () => void
  children: ReactNode
}): ReactElement {
  const { t } = useI18n()
  return (
    <AsideClosable
      title={t('assistant.open')}
      closeLabel={t('common.close')}
      onClose={onClose}
    >
      {children}
    </AsideClosable>
  )
}
