import { vi } from 'vitest'

import type { MatrixService } from '@/application/matrix'

export function fakeMatrix(): MatrixService {
  return {
    signIn: vi.fn(() => Promise.resolve(true)),
    signOut: vi.fn(() => Promise.resolve())
  }
}
