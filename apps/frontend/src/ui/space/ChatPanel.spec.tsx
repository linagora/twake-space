import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/testing/renderWithProviders'
import { ChatPanel } from '@/ui/space/ChatPanel'

function renderAt(chatUrl: string | null = 'https://chat.test/') {
  renderWithProviders(
    <Routes>
      <Route
        path="/spaces/:spaceId/chat/*"
        element={<ChatPanel spaceId="a1" roomId="!space:matrix.test" />}
      />
    </Routes>,
    { path: '/spaces/a1/chat', chatUrl }
  )
}

describe('ChatPanel', () => {
  it('frames the room of the space on the embed route of Chat', async () => {
    renderAt()
    const frame = await screen.findByTitle('Chat')
    expect(frame).toBeInstanceOf(HTMLIFrameElement)
    expect((frame as HTMLIFrameElement).src).toBe(
      'https://chat.test/embed/rooms/!space%3Amatrix.test'
    )
  })

  it('says when Chat is not set up', async () => {
    renderAt(null)
    expect(
      await screen.findByText('Chat is not set up for TwakeSpace.')
    ).toBeTruthy()
  })
})
