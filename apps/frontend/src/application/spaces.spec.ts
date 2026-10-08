import { describe, expect, it } from 'vitest'

import {
  pinnedAndRecent,
  rankSpaces,
  type SpaceSummary
} from '@/application/spaces'

const space = (
  id: string,
  marks: Partial<Pick<SpaceSummary, 'pinnedAt' | 'openedAt'>> = {}
): SpaceSummary => ({
  id,
  name: id,
  role: 'viewer',
  color: null,
  description: '',
  members: [],
  pinnedAt: null,
  openedAt: null,
  ...marks
})

const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T08:00:00.000Z`
const ids = (spaces: SpaceSummary[]) => spaces.map(s => s.id)

describe('pinnedAndRecent', () => {
  it('keeps the pinned spaces in the order of the list', () => {
    const { pinned } = pinnedAndRecent([
      space('a', { pinnedAt: day(2) }),
      space('b'),
      space('c', { pinnedAt: day(1) })
    ])

    expect(ids(pinned)).toEqual(['a', 'c'])
  })

  it('gives the five last opened spaces that are not pinned, newest first', () => {
    const { recent } = pinnedAndRecent([
      space('pinned', { pinnedAt: day(1), openedAt: day(9) }),
      space('never'),
      ...[1, 2, 3, 4, 5, 6].map(n =>
        space(`d${String(n)}`, { openedAt: day(n) })
      )
    ])

    expect(ids(recent)).toEqual(['d6', 'd5', 'd4', 'd3', 'd2'])
  })
})

describe('rankSpaces', () => {
  const spaces = [
    space('never'),
    space('old', { openedAt: day(1) }),
    space('new', { openedAt: day(3) }),
    space('news', { openedAt: day(2) })
  ]

  it('puts the spaces with news first, then the last opened', () => {
    expect(ids(rankSpaces(spaces, new Map([['news', 2]]), ''))).toEqual([
      'news',
      'new',
      'old',
      'never'
    ])
  })

  it('keeps only the names that hold the query', () => {
    expect(ids(rankSpaces(spaces, new Map(), 'NEW'))).toEqual(['new', 'news'])
  })
})
