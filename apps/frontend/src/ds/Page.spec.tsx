import { Archive } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IconEmpty, TileEmpty } from '@/ds/Page'
import { renderWithProviders } from '@/testing/renderWithProviders'

async function illustrationSize(): Promise<[string, string]> {
  await screen.findByText('Nothing here')
  const icon = document.querySelector('.Empty-icon')
  if (!icon) throw new Error('no empty-state illustration')
  const { width, height } = getComputedStyle(icon)
  return [width, height]
}

describe('empty states', () => {
  it('draws an icon illustration at 100 by 100 pixels', async () => {
    renderWithProviders(<IconEmpty icon={Archive} title="Nothing here" />)

    expect(await illustrationSize()).toEqual(['100px', '100px'])
  })

  it('draws an image illustration at 100 by 100 pixels', async () => {
    renderWithProviders(
      <TileEmpty icon={<img src="tile.svg" alt="" />} title="Nothing here" />
    )

    expect(await illustrationSize()).toEqual(['100px', '100px'])
  })
})
