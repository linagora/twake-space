import { describe, expect, it } from 'vitest'

import {
  fitBox,
  initialBox,
  parseBox,
  resizeBox
} from '@/ds/floatingWindowGeometry'

const screen = { width: 1280, height: 800 }

describe('floating window', () => {
  it('starts at the bottom right', () => {
    expect(initialBox(screen)).toEqual({
      x: 776,
      y: 456,
      width: 480,
      height: 320
    })
  })

  it('stays in a small viewport', () => {
    expect(initialBox({ width: 300, height: 180 })).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 180
    })
  })

  it('moves back inside after the viewport shrinks', () => {
    const box = { x: 1000, y: 600, width: 480, height: 320 }

    expect(fitBox(box, { width: 1024, height: 768 })).toEqual({
      x: 544,
      y: 448,
      width: 480,
      height: 320
    })
  })

  it('grows up to the edges and no smaller than the minimum', () => {
    const box = { x: 900, y: 500, width: 320, height: 200 }

    expect(resizeBox(box, { width: 500, height: 500 }, screen)).toEqual({
      ...box,
      width: 380,
      height: 300
    })
    expect(resizeBox(box, { width: -100, height: -100 }, screen)).toEqual(box)
  })

  it('reads a stored box and ignores anything else', () => {
    expect(parseBox('{"x":1,"y":2,"width":400,"height":300}')).toEqual({
      x: 1,
      y: 2,
      width: 400,
      height: 300
    })
    expect(parseBox('{"x":1}')).toBeNull()
    expect(parseBox('nope')).toBeNull()
    expect(parseBox(null)).toBeNull()
  })
})
