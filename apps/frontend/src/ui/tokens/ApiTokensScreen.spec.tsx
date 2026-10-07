import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ApiToken } from '@/application/tokens'
import { fakeTokens } from '@/testing/fakeTokens'
import { renderRoute } from '@/testing/renderWithProviders'

const assistant: ApiToken = {
  id: 't-1',
  name: 'My assistant',
  scopes: ['space:read', 'feed:read'],
  spaces: 'all',
  role: null,
  expiresAt: '2026-12-31T00:00:00.000Z',
  lastUsedAt: null,
  createdAt: '2026-10-01T09:00:00.000Z'
}

const digest: ApiToken = {
  ...assistant,
  id: 't-2',
  name: 'Weekly digest',
  spaces: ['roadmap', 'design'],
  role: 'viewer',
  expiresAt: null
}

const refusal = (status: number, reason: string) =>
  Object.assign(new Error('refused'), { status, code: 'forbidden', reason })

describe('ApiTokensScreen', () => {
  it('is reached from the sidebar and lists the personal tokens', async () => {
    renderRoute('/', { tokens: fakeTokens({ personal: [assistant] }) })

    fireEvent.click(await screen.findByRole('link', { name: 'API tokens' }))

    const list = await screen.findByRole('list', { name: 'Your tokens' })
    const item = within(list).getByRole('listitem')
    expect(item).toHaveTextContent('My assistant')
    expect(item).toHaveTextContent('Read spaces, Read feeds')
    expect(item).toHaveTextContent('All spaces')
    expect(item).toHaveTextContent('Expires Dec 31, 2026')
    expect(item).toHaveTextContent('Never used')
    expect(document.title).toBe('API tokens - Twake Space')
  })

  it('lists the organization tokens with their role and spaces', async () => {
    renderRoute('/settings/api-tokens/organization', {
      tokens: fakeTokens({ organization: [digest] })
    })

    const list = await screen.findByRole('list', {
      name: 'Organization tokens'
    })
    const item = within(list).getByRole('listitem')
    expect(item).toHaveTextContent('2 spaces')
    expect(item).toHaveTextContent('Never expires')
    expect(item).toHaveTextContent('Viewer')
  })

  it('tells someone who is not an organization admin who manages its tokens', async () => {
    const tokens = fakeTokens()
    vi.mocked(tokens.list).mockRejectedValue(
      refusal(403, 'not an admin of the organization')
    )
    renderRoute('/settings/api-tokens/organization', { tokens })

    expect(
      await screen.findByText(
        "Only the organization's owners and admins manage its tokens."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create a token' })
    ).not.toBeInTheDocument()
  })

  it('sends an unknown tab back to the personal tokens', async () => {
    renderRoute('/settings/api-tokens/elsewhere')

    expect(
      await screen.findByRole('tab', { name: 'Personal', selected: true })
    ).toBeInTheDocument()
  })
})
