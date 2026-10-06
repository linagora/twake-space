import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { HomeScreen } from '@/ui/home/HomeScreen'

describe('HomeScreen', () => {
  it('heads the page with the spaces and titles it with the app name', async () => {
    renderWithProviders(<HomeScreen />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Spaces' })
    ).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    await waitFor(() => {
      expect(document.title).toBe('Twake Space')
    })
  })

  it('follows the UI language', async () => {
    renderWithProviders(<HomeScreen />, { lang: 'fr' })

    expect(await screen.findByRole('main')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('fr')
  })

  it("lists the person's spaces with their role, each opening the space", async () => {
    const spaces = fakeSpaces([
      { id: 'a1', name: 'Design Sprint', role: 'admin' },
      { id: 'b2', name: 'Roadmap', role: 'viewer' }
    ])
    renderWithProviders(<HomeScreen />, { spaces })

    expect(
      await screen.findByRole('link', { name: 'Design Sprint' })
    ).toHaveAttribute('href', '/spaces/a1')
    const [sprint, roadmap] = screen.getAllByRole('listitem')
    expect(sprint).toHaveTextContent('Design SprintAdmin')
    expect(roadmap).toHaveTextContent('RoadmapViewer')
  })

  it('shows an empty state with the create action when there is no space', async () => {
    renderWithProviders(<HomeScreen />)

    expect(
      await screen.findByText('You are not in any space yet.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create a space' })
    ).toBeInTheDocument()
  })

  it('creates a space by name and lists it as its admin', async () => {
    const spaces = fakeSpaces()
    renderWithProviders(<HomeScreen />, { spaces })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a space' })
    )
    const dialog = await screen.findByRole('dialog')
    const create = within(dialog).getByRole('button', { name: 'Create' })
    expect(create).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: '  Launch  ' }
    })
    fireEvent.click(create)

    await screen.findByRole('link', { name: 'Launch' })
    expect(screen.getByRole('listitem')).toHaveTextContent('LaunchAdmin')
    expect(spaces.create).toHaveBeenCalledWith('Launch')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('keeps the dialog open and says so when the creation fails', async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.create).mockRejectedValue(new Error('down'))
    renderWithProviders(<HomeScreen />, { spaces })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a space' })
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Launch' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(
      await within(dialog).findByText('The space could not be created.')
    ).toBeInTheDocument()
  })

  it('says the spaces are loading', async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.list).mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<HomeScreen />, { spaces })

    expect(
      await screen.findByRole('status', { name: 'Loading spaces…' })
    ).toBeInTheDocument()
  })

  it('says so when the spaces cannot be loaded', async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.list).mockRejectedValue(
      Object.assign(new Error('forbidden'), { status: 403 })
    )
    renderWithProviders(<HomeScreen />, { spaces })

    expect(
      await screen.findByText('Your spaces could not be loaded.')
    ).toBeInTheDocument()
  })
})
