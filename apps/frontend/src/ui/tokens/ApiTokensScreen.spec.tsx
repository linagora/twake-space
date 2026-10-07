import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ApiToken } from '@/application/tokens'
import { fakeSpaces } from '@/testing/fakeSpaces'
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

  it('creates a personal token and shows its secret once', async () => {
    const tokens = fakeTokens()
    renderRoute('/settings/api-tokens', { tokens })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a token' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'New personal token'
    })
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: '  Backup script ' }
    })
    fireEvent.click(within(dialog).getByLabelText('Read feeds'))
    fireEvent.change(within(dialog).getByLabelText('Expires in'), {
      target: { value: '90' }
    })
    expect(within(dialog).queryByLabelText('Role in its spaces')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    const secret = await screen.findByRole('dialog', {
      name: 'Backup script is ready'
    })
    expect(within(secret).getByLabelText('Token')).toHaveValue('tws_token-1')
    expect(tokens.create).toHaveBeenCalledWith('personal', {
      name: 'Backup script',
      scopes: ['space:read', 'feed:read'],
      spaces: 'all',
      expiresInDays: 90
    })

    fireEvent.click(within(secret).getByRole('button', { name: 'Done' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(
      await screen.findByRole('list', { name: 'Your tokens' })
    ).toHaveTextContent('Backup script')
  })

  it('creates an organization token for some spaces with a role', async () => {
    const tokens = fakeTokens()
    renderRoute('/settings/api-tokens/organization', {
      tokens,
      spaces: fakeSpaces([
        {
          id: 'roadmap',
          name: 'Roadmap',
          role: 'admin',
          color: null,
          description: '',
          members: []
        }
      ])
    })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a token' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'New organization token'
    })
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Digest' }
    })
    fireEvent.click(within(dialog).getByLabelText('Some spaces'))
    const create = within(dialog).getByRole('button', { name: 'Create' })
    expect(create).toBeDisabled()
    fireEvent.click(await within(dialog).findByLabelText('Roadmap'))
    fireEvent.change(within(dialog).getByLabelText('Role in its spaces'), {
      target: { value: 'editor' }
    })
    fireEvent.click(create)

    await screen.findByRole('dialog', { name: 'Digest is ready' })
    expect(tokens.create).toHaveBeenCalledWith('organization', {
      name: 'Digest',
      scopes: ['space:read'],
      spaces: ['roadmap'],
      role: 'editor',
      expiresInDays: 30
    })
  })

  it("shows the backend's reason when a token is refused", async () => {
    const tokens = fakeTokens()
    vi.mocked(tokens.create).mockRejectedValue(
      refusal(400, 'the policy caps tokens at 7 days')
    )
    renderRoute('/settings/api-tokens', { tokens })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a token' })
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'CI' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(
      await within(dialog).findByText(
        'Refused: the policy caps tokens at 7 days'
      )
    ).toBeInTheDocument()
  })

  it('renames a token', async () => {
    const tokens = fakeTokens({ personal: [assistant] })
    renderRoute('/settings/api-tokens', { tokens })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Rename My assistant' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Rename the token'
    })
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Assistant' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(tokens.rename).toHaveBeenCalledWith('personal', 't-1', 'Assistant')
    })
  })

  it('revokes a token after confirming', async () => {
    const tokens = fakeTokens({ organization: [digest] })
    renderRoute('/settings/api-tokens/organization', { tokens })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Revoke Weekly digest' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Revoke Weekly digest?'
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(tokens.revoke).toHaveBeenCalledWith('organization', 't-2')
    })
  })

  it('sends an unknown tab back to the personal tokens', async () => {
    renderRoute('/settings/api-tokens/elsewhere')

    expect(
      await screen.findByRole('tab', { name: 'Personal', selected: true })
    ).toBeInTheDocument()
  })
})
