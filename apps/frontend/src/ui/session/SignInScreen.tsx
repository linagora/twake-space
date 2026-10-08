import { Button } from '@linagora/twake-mui'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement
} from 'react'

import spaceIcon from '@/assets/space.svg'
import workplaceLogo from '@/assets/twake-workplace.svg'
import { useI18n } from '@/ui/i18n/useI18n'

const SLOW_AFTER_MS = 3000
// Before twake-oidc gives up on discovery (10s), so a hung SSO reads as slow
// rather than as a failure.
const TIMEOUT_AFTER_MS = 8000
const DESTINATION_KEY = 'twake-space:sign-in-destination'

type Destination = 'space' | 'home'

// The SSO sends the browser back to its callback path, so the destination is
// kept from before the redirect to say the same words on the way back.
function readDestination(): Destination {
  try {
    if (window.location.pathname.startsWith('/spaces/')) {
      sessionStorage.setItem(DESTINATION_KEY, 'space')
      return 'space'
    }
    return sessionStorage.getItem(DESTINATION_KEY) === 'space'
      ? 'space'
      : 'home'
  } catch {
    return 'home'
  }
}

export function forgetDestination(): void {
  try {
    sessionStorage.removeItem(DESTINATION_KEY)
  } catch {
    // Nothing kept, nothing to forget.
  }
}

const growAnimation = (icon: Element | null): Animation | undefined =>
  icon && 'getAnimations' in icon ? icon.getAnimations()[0] : undefined

export interface SignInScreenProps {
  failed?: boolean
  leaving?: boolean
  onSignIn: () => void
}

export function SignInScreen({
  failed = false,
  leaving = false,
  onSignIn
}: SignInScreenProps): ReactElement {
  const { t } = useI18n()
  const [destination] = useState(readDestination)
  const [waited, setWaited] = useState<'short' | 'slow' | 'timeout'>('short')
  const icon = useRef<HTMLSpanElement>(null)

  // index.html draws this screen before any script runs: carry on from the
  // same point of its animation so the icon does not jump.
  useLayoutEffect(() => {
    const page = document.getElementById('splash')
    const time = growAnimation(
      page?.querySelector('.splash-icon') ?? null
    )?.currentTime
    const mine = growAnimation(icon.current)
    if (mine && typeof time === 'number') mine.currentTime = time
    page?.remove()
  }, [])

  useEffect(() => {
    if (failed || leaving) return
    const slow = setTimeout(() => {
      setWaited('slow')
    }, SLOW_AFTER_MS)
    const timeout = setTimeout(() => {
      setWaited('timeout')
    }, TIMEOUT_AFTER_MS)
    return () => {
      clearTimeout(slow)
      clearTimeout(timeout)
    }
  }, [failed, leaving])

  const timedOut = waited === 'timeout' && !leaving
  const stuck = failed || timedOut
  let status = t(
    destination === 'space' ? 'session.openingSpace' : 'session.signingIn'
  )
  if (waited === 'slow') status = t('session.slow')

  return (
    <div
      className={leaving ? 'splash splash-leaving' : 'splash'}
      aria-busy={!stuck}
      inert={leaving}
      aria-hidden={leaving || undefined}
    >
      <span ref={icon} className="splash-icon" aria-hidden="true">
        <img src={spaceIcon} alt="" />
      </span>
      {stuck ? (
        <>
          <h1 className="splash-title">
            {t(timedOut ? 'session.timeout' : 'session.failed')}
          </h1>
          <p className="splash-hint">
            {t(timedOut ? 'session.timeoutHint' : 'session.failedHint')}
          </p>
          <div className="splash-actions">
            <Button
              variant="contained"
              onClick={() => {
                window.location.reload()
              }}
            >
              {t('session.retry')}
            </Button>
            <Button variant="text" onClick={onSignIn}>
              {t('session.backToSignIn')}
            </Button>
          </div>
        </>
      ) : (
        <p className="splash-status" role="status">
          {status}
        </p>
      )}
      <img
        className="splash-workplace"
        src={workplaceLogo}
        alt=""
        aria-hidden="true"
      />
    </div>
  )
}
