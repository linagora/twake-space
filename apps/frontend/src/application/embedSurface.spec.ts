import { describe, expect, it } from 'vitest'

import {
  overlayClipPath,
  parseOverlayRegion,
  parseSurfaceMessage,
  surfaceInit
} from '@/application/embedSurface'

describe('parseOverlayRegion', () => {
  it('takes the whole page or a list of boxes', () => {
    expect(parseOverlayRegion('full')).toBe('full')
    expect(
      parseOverlayRegion([{ x: 10, y: 20, width: 300, height: 400 }])
    ).toEqual([{ x: 10, y: 20, width: 300, height: 400 }])
    expect(parseOverlayRegion([])).toEqual([])
  })

  it('refuses anything else', () => {
    expect(parseOverlayRegion('all')).toBeNull()
    expect(parseOverlayRegion([{ x: 1, y: 2, width: 3 }])).toBeNull()
    expect(
      parseOverlayRegion([{ x: 1, y: 2, width: -3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion([{ x: 'a', y: 2, width: 3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion([{ x: Infinity, y: 2, width: 3, height: 4 }])
    ).toBeNull()
    const many = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      width: 1,
      height: 1
    }))
    expect(parseOverlayRegion(many)).toBeNull()
  })
})

describe('overlayClipPath', () => {
  it('shows nothing until the app draws', () => {
    expect(overlayClipPath(null)).toBe('inset(0 0 100% 0)')
    expect(overlayClipPath([])).toBe('inset(0 0 100% 0)')
  })

  it('shows the whole page while the app blocks it', () => {
    expect(overlayClipPath('full')).toBe('none')
  })

  it('shows the boxes the app draws', () => {
    expect(
      overlayClipPath([
        { x: 10, y: 20, width: 300, height: 400 },
        { x: 0, y: 0, width: 5, height: 5 }
      ])
    ).toBe("path('M10 20h300v400h-300Z M0 0h5v5h-5Z')")
  })
})

describe('parseSurfaceMessage', () => {
  it('reads the messages of the overlay', () => {
    expect(parseSurfaceMessage({ type: 'intent:ready' })).toEqual({
      type: 'ready'
    })
    expect(
      parseSurfaceMessage({
        type: 'twake-surface:region',
        intentId: 'i1',
        payload: { region: 'full' }
      })
    ).toEqual({ type: 'region', intentId: 'i1', region: 'full' })
    expect(
      parseSurfaceMessage({
        type: 'intent:error',
        intentId: 'i1',
        payload: { code: 'unsupported_protocol' }
      })
    ).toEqual({ type: 'error', intentId: 'i1', code: 'unsupported_protocol' })
  })

  it('ignores anything else', () => {
    expect(parseSurfaceMessage('intent:ready')).toBeNull()
    expect(parseSurfaceMessage({ type: 'intent:done' })).toBeNull()
    expect(
      parseSurfaceMessage({
        type: 'twake-surface:region',
        payload: { region: 'full' }
      })
    ).toBeNull()
    expect(
      parseSurfaceMessage({
        type: 'twake-surface:region',
        intentId: 'i1',
        payload: { region: 'everything' }
      })
    ).toBeNull()
  })
})

describe('surfaceInit', () => {
  it('starts the intent of the overlay', () => {
    expect(surfaceInit('i1')).toEqual({
      type: 'intent:init',
      intentId: 'i1',
      payload: {
        action: 'TWAKE_SURFACE',
        protocol: 'twake-surface/1',
        slot: 'overlay'
      }
    })
  })
})
