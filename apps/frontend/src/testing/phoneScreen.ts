import { vi } from 'vitest'

// Every max-width query matches, so the shell keeps its navigation in a menu.
export function stubPhoneScreen(): void {
  stubMediaQueries(query => query.includes('max-width'))
}

export function stubTouchScreen(): void {
  stubMediaQueries(query => query === '(pointer: coarse)')
}

// jsdom applies no media query: read the value the rules below lg
// (`max-width`) or from lg up (`min-width`) give the element.
export function mediaStyle(
  element: Element,
  property: string,
  media: 'max-width' | 'min-width'
): string {
  let value = ''
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSMediaRule)) continue
      if (!rule.conditionText.includes(media)) continue
      for (const inner of Array.from(rule.cssRules)) {
        if (
          inner instanceof CSSStyleRule &&
          element.matches(inner.selectorText) &&
          inner.style.getPropertyValue(property)
        ) {
          value = inner.style.getPropertyValue(property)
        }
      }
    }
  }
  return value
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
