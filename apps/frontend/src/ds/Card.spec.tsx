import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MemberAvatars } from '@/ds/Card'
import { renderWithProviders } from '@/testing/renderWithProviders'

const people = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <span key={index} role="img" aria-label={`Member ${String(index)}`} />
  ))

describe('MemberAvatars', () => {
  it('shows every member that fits', async () => {
    renderWithProviders(<MemberAvatars>{people(5)}</MemberAvatars>)

    expect(await screen.findAllByRole('img')).toHaveLength(5)
    expect(screen.queryByText(/^\+/)).toBe(null)
  })

  it('keeps a place for the count of the members it leaves out', async () => {
    renderWithProviders(<MemberAvatars>{people(7)}</MemberAvatars>)

    expect(await screen.findAllByRole('img')).toHaveLength(4)
    expect(screen.getByText('+3')).toBeInTheDocument()
  })
})
