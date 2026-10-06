export interface MatrixService {
  /** Resolves to false when the browser is being sent to the homeserver's sign-in. */
  signIn: (homeserverUrl: string) => Promise<boolean>
  /** Logs this browser's device out of the homeserver. */
  signOut: () => Promise<void>
}
