import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { KeptAliveStack } from '@/ds/KeptAlive'
import { mediaStyle } from '@/testing/phoneScreen'
import { renderWithProviders } from '@/testing/renderWithProviders'

describe('KeptAliveStack', () => {
  it('on a phone, takes the screen between the pinned header and the bottom bar', async () => {
    renderWithProviders(
      <KeptAliveStack active role="tabpanel" aria-label="Chat">
        <iframe title="Chat" />
      </KeptAliveStack>
    )

    const stack = await screen.findByRole('tabpanel', { name: 'Chat' })
    expect(mediaStyle(stack, 'height', 'max-width')).toBe(
      'calc(100dvh - var(--sidebarHeight, 0px) - 56px)'
    )
  })

  it('keeps no height of its own while hidden', async () => {
    renderWithProviders(
      <KeptAliveStack
        active={false}
        reachable
        role="tabpanel"
        aria-label="Chat"
      >
        <iframe title="Chat" />
      </KeptAliveStack>
    )

    const stack = (await screen.findByTitle('Chat')).parentElement
    expect(stack).toBeTruthy()
    expect(mediaStyle(stack as Element, 'height', 'max-width')).toBe('')
  })
})
