export interface User {
  /** The backend's user id, the SSO's `uuid` claim. */
  id: string | null
  name: string | null
  email: string | null
  /** The address of the person's Twake Workplace instance, like `alice.twake.app`. */
  workplaceFqdn: string | null
}

export interface SessionService {
  /** Resolves to null when the browser is being sent to the SSO. */
  start: () => Promise<User | null>
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  onEndedElsewhere: (onEnded: () => void) => () => void
}
