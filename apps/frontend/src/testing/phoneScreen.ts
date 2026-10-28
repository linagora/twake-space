import { vi } from 'vitest'

// Every max-width query matches, so the shell shows its phone bottom bar.
export function stubPhoneScreen(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }))
}
