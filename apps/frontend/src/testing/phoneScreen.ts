import { vi } from 'vitest'

// Every max-width query matches, so the shell keeps its navigation in a menu.
export function stubPhoneScreen(): void {
  stubMediaQueries(query => query.includes('max-width'))
}

export function stubTouchScreen(): void {
  stubMediaQueries(query => query === '(pointer: coarse)')
}

function stubMediaQueries(matches: (query: string) => boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches(query),
    media: query,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }))
}
