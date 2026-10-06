import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import type { SessionService, User } from '@/application/session'
import { forgetDestination, SignInScreen } from '@/ui/session/SignInScreen'

// Matches .splash-leaving in index.html.
const SPLASH_FADE_MS = 200

export interface Session {
  user: User
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = use(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionGate')
  return session
}

type GateState =
  | { status: 'pending' }
  | { status: 'failed' }
  | { status: 'signedIn'; user: User }

export interface SessionGateProps {
  session: SessionService
  children: ReactNode
}

export function SessionGate({
  session,
  children
}: SessionGateProps): ReactElement {
  const [state, setState] = useState<GateState>({ status: 'pending' })
  // StrictMode runs effects twice; a second start would find the sign-in spent
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    session.start().then(
      user => {
        if (user) setState({ status: 'signedIn', user })
      },
      (error: unknown) => {
        console.error('Sign-in failed:', error)
        setState({ status: 'failed' })
      }
    )
  }, [session])

  const signedIn = state.status === 'signedIn'
  useEffect(() => {
    if (!signedIn) return
    return session.onEndedElsewhere(() => void session.signIn())
  }, [session, signedIn])

  const [splashGone, setSplashGone] = useState(false)
  useEffect(() => {
    if (!signedIn) return
    forgetDestination()
    const gone = setTimeout(() => {
      setSplashGone(true)
    }, SPLASH_FADE_MS)
    return () => {
      clearTimeout(gone)
    }
  }, [signedIn])

  // The screen keeps its place in the tree while the app mounts beneath it,
  // so it fades out instead of being replaced.
  return (
    <>
      {state.status === 'signedIn' && (
        <SessionContext
          value={{
            user: state.user,
            signIn: session.signIn,
            signOut: session.signOut
          }}
        >
          {children}
        </SessionContext>
      )}
      {!splashGone && (
        <SignInScreen
          failed={state.status === 'failed'}
          leaving={signedIn}
          onSignIn={() => void session.signIn()}
        />
      )}
    </>
  )
}
