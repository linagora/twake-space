import { vi } from 'vitest'

import type { SessionService, User } from '@/application/session'

export function fakeSession(
  start: () => Promise<User | null> = () =>
    Promise.resolve({
      id: 'u-me',
      name: 'Alice Martin',
      email: 'alice@example.com',
      workplaceFqdn: 'alice.twake.test'
    })
): SessionService & { endElsewhere: () => void } {
  let onEnded: (() => void) | null = null
  return {
    start: vi.fn(start),
    signIn: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    onEndedElsewhere: callback => {
      onEnded = callback
      return () => {
        onEnded = null
      }
    },
    endElsewhere: () => onEnded?.()
  }
}
