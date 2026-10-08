import { screen } from '@testing-library/react'
import { TWAKE_BAR_HEIGHT } from '@linagora/twake-bar'
import { describe, expect, it } from 'vitest'

import { AppFrame } from '@/ds/AppFrame'
import { renderWithProviders } from '@/testing/renderWithProviders'

async function barHeightOfFrame(): Promise<string> {
  const frame = (await screen.findByText('nav')).closest('aside')?.parentElement
  if (!frame) throw new Error('no frame')
  return getComputedStyle(frame).getPropertyValue('--topBarHeight')
}

describe('AppFrame', () => {
  it('leaves room for the platform bar above it', async () => {
    renderWithProviders(
      <AppFrame topBar={<div />} sidebar={<span>nav</span>}>
        page
      </AppFrame>
    )

    expect(await barHeightOfFrame()).toBe(TWAKE_BAR_HEIGHT)
  })

  it('takes the whole window without a bar', async () => {
    renderWithProviders(<AppFrame sidebar={<span>nav</span>}>page</AppFrame>)

    expect(await barHeightOfFrame()).toBe('0px')
  })
})
