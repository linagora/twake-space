import { describe, expect, it } from 'vitest'

import {
  badgesOf,
  emptyMetadata,
  homeFigure,
  replaceMetadata,
  resetMetadata
} from '@/application/metadata'
import type { Space } from '@/application/spaces'

const space: Pick<Space, 'resources'> = {
  resources: [
    { kind: 'project', id: 'p1' },
    { kind: 'drive', id: null },
    { kind: 'calendar', id: 'cal-1' }
  ]
}

describe('homeFigure', () => {
  it('waits for an app that has sent no metadata', () => {
    expect(homeFigure(emptyMetadata(), space, 'tasks')).toBeUndefined()
  })

  it("reads the app's metadata for the space's resource", () => {
    const snapshots = replaceMetadata(emptyMetadata(), 'calendar', [
      { resourceId: 'cal-1', name: 'events.upcoming', value: 3 },
      { resourceId: 'cal-2', name: 'events.upcoming', value: 9 }
    ])

    expect(homeFigure(snapshots, space, 'events')).toBe(3)
  })

  it('waits for a resource the app left out, or the space lacks', () => {
    const snapshots = replaceMetadata(
      replaceMetadata(emptyMetadata(), 'calendar', [
        { resourceId: 'cal-2', name: 'events.upcoming', value: 9 }
      ]),
      'drive',
      [{ resourceId: 'd1', name: 'files.count', value: 4 }]
    )

    expect(homeFigure(snapshots, space, 'events')).toBeUndefined()
    expect(homeFigure(snapshots, space, 'files')).toBeUndefined()
  })

  it('makes a share of the tasks done, none of an empty project', () => {
    const tasks = (done: number | string, total: number) =>
      homeFigure(
        replaceMetadata(emptyMetadata(), 'tasks', [
          { resourceId: 'p1', name: 'tasks.done', value: done },
          { resourceId: 'p1', name: 'tasks.total', value: total }
        ]),
        space,
        'tasks'
      )

    expect(tasks(21, 25)).toBe(84)
    expect(tasks(30, 25)).toBe(100)
    expect(tasks(0, 0)).toBeNull()
    expect(tasks('21', 25)).toBeUndefined()
  })

  it('forgets the app on a reset, and keeps a snapshot whole', () => {
    const first = replaceMetadata(emptyMetadata(), 'tasks', [
      { resourceId: 'p1', name: 'tasks.done', value: 1 },
      { resourceId: 'p1', name: 'tasks.total', value: 2 }
    ])
    const next = replaceMetadata(first, 'tasks', [
      { resourceId: 'p1', name: 'tasks.total', value: 2 }
    ])

    expect(homeFigure(first, space, 'tasks')).toBe(50)
    expect(homeFigure(next, space, 'tasks')).toBeUndefined()
    expect(
      homeFigure(resetMetadata(first, 'tasks'), space, 'tasks')
    ).toBeUndefined()
  })
})

describe('badgesOf', () => {
  it('reads the counts under badge', () => {
    expect(
      badgesOf([
        { resourceId: 'p1', name: 'badge', value: 2 },
        { resourceId: 'p1', name: 'tasks.done', value: 5 },
        { resourceId: 'p2', name: 'badge', value: 'two' }
      ])
    ).toEqual([{ resourceId: 'p1', count: 2 }])
  })
})
