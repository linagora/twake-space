import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// A loaded CI runner takes over a second to mount the first MUI screen.
configure({ reactStrictMode: true, asyncUtilTimeout: 3000 })

// jsdom lays nothing out, so it has no scrolling to do.
Element.prototype.scrollIntoView = () => undefined

// Nor any resizing, which the bottom sheet's spring measures.
globalThis.ResizeObserver = class {
  observe = () => undefined
  unobserve = () => undefined
  disconnect = () => undefined
}

afterEach(cleanup)
