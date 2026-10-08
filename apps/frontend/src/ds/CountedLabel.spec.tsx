import { Stack } from '@linagora/twake-mui'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CountedLabel } from '@/ds/CountedLabel'
import { renderWithProviders } from '@/testing/renderWithProviders'

describe('CountedLabel', () => {
  it('lays the label and its count out in a row of their own, whatever holds them', async () => {
    renderWithProviders(
      <Stack>
        <CountedLabel label="Chat" count="3" />
      </Stack>
    )

    const row = await screen.findByText('Chat')
    expect(row).toHaveTextContent('Chat3')
    expect(getComputedStyle(row).display).toBe('inline-flex')
    expect(getComputedStyle(row).alignItems).toBe('flex-start')
  })

  it('shows no badge without a count', async () => {
    renderWithProviders(<CountedLabel label="Chat" count={null} />)

    expect(await screen.findByText('Chat')).toBeInTheDocument()
    expect(document.querySelector('.MuiBadge-root')).toBe(null)
  })
})
