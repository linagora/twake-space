export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

const MIN_SIZE: Size = { width: 320, height: 200 }
const DEFAULT_SIZE: Size = { width: 480, height: 320 }
const MARGIN = 24

// Bottom right, where it hides the least of the page.
export function initialBox(viewport: Size): Box {
  return fitBox(
    {
      ...DEFAULT_SIZE,
      x: viewport.width - DEFAULT_SIZE.width - MARGIN,
      y: viewport.height - DEFAULT_SIZE.height - MARGIN
    },
    viewport
  )
}

// Inside the viewport, and no smaller than the minimum unless the viewport is.
export function fitBox(box: Box, viewport: Size): Box {
  const width = clamp(box.width, MIN_SIZE.width, viewport.width)
  const height = clamp(box.height, MIN_SIZE.height, viewport.height)
  return {
    width,
    height,
    x: clamp(box.x, 0, viewport.width - width),
    y: clamp(box.y, 0, viewport.height - height)
  }
}

// A resize from the bottom right corner grows up to the viewport's edges.
export function resizeBox(box: Box, by: Size, viewport: Size): Box {
  return fitBox(
    {
      ...box,
      width: Math.min(box.width + by.width, viewport.width - box.x),
      height: Math.min(box.height + by.height, viewport.height - box.y)
    },
    viewport
  )
}

export function parseBox(text: string | null): Box | null {
  if (!text) return null
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null) return null
    const { x, y, width, height } = value as Record<string, unknown>
    return [x, y, width, height].every(Number.isFinite) ? (value as Box) : null
  } catch {
    return null
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), Math.min(min, max), 0)
}
