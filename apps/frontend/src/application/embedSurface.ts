// The overlay an embedded app draws on, over the whole page of TwakeSpace
// (twake-space-architecture specs/twake-surface.md). It is a frame on the
// app's origin: the app renders its docked windows and dialogs into it, and
// TwakeSpace only shows the region the app says it draws in, so the rest of
// the page keeps its clicks.

export const SURFACE_PROTOCOL = 'twake-surface/1'

export interface OverlayBox {
  x: number
  y: number
  width: number
  height: number
}

// 'full' while the app blocks the page (a dialog, a menu), else its boxes.
export type OverlayRegion = 'full' | readonly OverlayBox[]

export type SurfaceMessage =
  | { type: 'ready' }
  | { type: 'region'; intentId: string; region: OverlayRegion }
  | { type: 'error'; intentId: string; code: string }

const MAX_BOXES = 32
const MAX_SIZE = 100_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCoordinate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_SIZE
  )
}

function toBox(value: unknown): OverlayBox | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  if (
    !isCoordinate(x) ||
    !isCoordinate(y) ||
    !isCoordinate(width) ||
    !isCoordinate(height)
  ) {
    return null
  }
  if (width < 0 || height < 0) return null
  return { x, y, width, height }
}

export function parseOverlayRegion(value: unknown): OverlayRegion | null {
  if (value === 'full') return 'full'
  if (!Array.isArray(value) || value.length > MAX_BOXES) return null
  const boxes: OverlayBox[] = []
  for (const item of value) {
    const box = toBox(item)
    if (box === null) return null
    boxes.push(box)
  }
  return boxes
}

// What the overlay frame posts: Open Buro's `intent:ready` and `intent:error`,
// and the region it draws in.
export function parseSurfaceMessage(data: unknown): SurfaceMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') return null
  if (data.type === 'intent:ready') return { type: 'ready' }
  const { intentId, payload } = data
  if (typeof intentId !== 'string' || !isRecord(payload)) return null
  if (data.type === 'twake-surface:region') {
    const region = parseOverlayRegion(payload.region)
    return region === null ? null : { type: 'region', intentId, region }
  }
  if (data.type === 'intent:error') {
    return {
      type: 'error',
      intentId,
      code: typeof payload.code === 'string' ? payload.code : 'unknown'
    }
  }
  return null
}

export function surfaceInit(intentId: string): {
  type: 'intent:init'
  intentId: string
  payload: { action: 'TWAKE_SURFACE'; protocol: string; slot: 'overlay' }
} {
  return {
    type: 'intent:init',
    intentId,
    payload: {
      action: 'TWAKE_SURFACE',
      protocol: SURFACE_PROTOCOL,
      slot: 'overlay'
    }
  }
}

// The overlay shows nothing until the app says what it draws.
export function overlayClipPath(region: OverlayRegion | null): string {
  if (region === 'full') return 'none'
  if (region === null || region.length === 0) return 'inset(0 0 100% 0)'
  const boxes = region.map(({ x, y, width, height }) =>
    ['M', x, ' ', y, 'h', width, 'v', height, 'h', -width, 'Z'].join('')
  )
  return `path('${boxes.join(' ')}')`
}
