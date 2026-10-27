import { describe, expect, it } from 'vitest'

import { chatFavourites, favouriteChanges } from '@/application/favourites'
import { emptyMetadata, replaceMetadata } from '@/application/metadata'

describe('chatFavourites', () => {
  it('reads the favourite of each Matrix space Chat reported', () => {
    const snapshots = replaceMetadata(emptyMetadata(), 'chat', [
      { resourceId: '!a', name: 'badge', value: 3 },
      { resourceId: '!a', name: 'favourite', value: 1 },
      { resourceId: '!b', name: 'favourite', value: 0 },
      { resourceId: '!c', name: 'badge', value: 1 }
    ])

    expect(chatFavourites(snapshots)).toEqual(
      new Map([
        ['!a', 1],
        ['!b', 0]
      ])
    )
  })
})

describe('favouriteChanges', () => {
  it('pins a space Chat reports as favourite for the first time', () => {
    expect(
      favouriteChanges(
        {},
        new Map([
          ['!a', 1],
          ['!b', 0]
        ])
      )
    ).toEqual({ pin: ['!a'], unpin: [] })
  })

  it('follows what changed in Chat since the last report', () => {
    expect(
      favouriteChanges(
        { '!a': 0, '!b': 1, '!c': 1 },
        new Map([
          ['!a', 1],
          ['!b', 0],
          ['!c', 1]
        ])
      )
    ).toEqual({ pin: ['!a'], unpin: ['!b'] })
  })
})
