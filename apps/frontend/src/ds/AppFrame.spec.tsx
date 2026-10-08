import { fireEvent, screen } from '@testing-library/react'
import { TWAKE_BAR_HEIGHT } from '@linagora/twake-bar'
import { useState, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { AppFrame } from '@/ds/AppFrame'
import { renderWithProviders } from '@/testing/renderWithProviders'

async function barHeightOfFrame(): Promise<string> {
  const frame = (await screen.findByText('nav')).closest('aside')?.parentElement
  if (!frame) throw new Error('no frame')
  return getComputedStyle(frame).getPropertyValue('--topBarHeight')
}

// A frame of the content, a panel beside it, and a switch that gives it the page
function Switchable({ onLoad }: { onLoad: () => void }): ReactElement {
  const [alone, setAlone] = useState(false)
  return (
    <AppFrame
      topBar={<p>bar</p>}
      sidebar={<span>nav</span>}
      aside={<p>aside</p>}
      alone={alone}
    >
      <button
        onClick={() => {
          setAlone(!alone)
        }}
      >
        switch
      </button>
      <iframe title="app" onLoad={onLoad} />
    </AppFrame>
  )
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

  it('gives the whole page to the content alone, without loading its frames again', async () => {
    const onLoad = vi.fn()
    renderWithProviders(<Switchable onLoad={onLoad} />)
    const frame = await screen.findByTitle('app')
    onLoad.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    expect(screen.queryByText('bar')).toBe(null)
    expect(screen.queryByText('nav')).toBe(null)
    // A panel opened beside the content stays
    expect(screen.getByText('aside')).toBeInTheDocument()
    expect(screen.getByTitle('app')).toBe(frame)

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))

    expect(screen.getByText('bar')).toBeInTheDocument()
    expect(screen.getByText('nav')).toBeInTheDocument()
    expect(screen.getByTitle('app')).toBe(frame)
    expect(onLoad).not.toHaveBeenCalled()
  })
})
