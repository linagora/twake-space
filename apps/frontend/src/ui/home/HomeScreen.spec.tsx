import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fakeSpaces } from '@/testing/fakeSpaces'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { HomeScreen } from '@/ui/home/HomeScreen'

describe('HomeScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('greets the person by first name with the date, and titles the page with the app name', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 29, 14))
    renderWithProviders(<HomeScreen />)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Good afternoon, Alice'
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Tuesday, September 29')).toBeInTheDocument()
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

  it("shows the person's spaces as cards after a create card, each opening the space", async () => {
    const spaces = fakeSpaces([
      { id: 'a1', name: 'Design Sprint', role: 'admin', color: null },
      { id: 'b2', name: 'Roadmap', role: 'viewer', color: null }
    ])
    renderWithProviders(<HomeScreen />, { spaces })

    const all = await screen.findByRole('region', { name: 'All spaces' })
    const [create, sprint, roadmap] = within(all).getAllByRole('listitem')
    expect(create).toHaveTextContent('Create a space')
    expect(sprint).toHaveTextContent('Design Sprint')
    expect(roadmap).toHaveTextContent('Roadmap')
    expect(
      within(all).getByRole('link', { name: 'Design Sprint' })
    ).toHaveAttribute('href', '/spaces/a1')
  })

  it('shows an empty state with the create action when there is no space', async () => {
    renderWithProviders(<HomeScreen />)

    expect(
      await screen.findByText('Create your first space')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create a space' })
    ).toBeInTheDocument()
  })

  it('creates a space with the description, color and apps picked, and shows its card', async () => {
    const spaces = fakeSpaces()
    renderWithProviders(<HomeScreen />, { spaces })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a space' })
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Space name'), {
      target: { value: '  Launch  ' }
    })
    fireEvent.change(within(dialog).getByLabelText('Describe (optional)'), {
      target: { value: ' Ship it ' }
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Personalize space' })
    )
    fireEvent.click(within(dialog).getByRole('radio', { name: '#46a2ff' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }))

    expect(within(dialog).getByRole('checkbox', { name: 'Feed' })).toBeChecked()
    expect(
      within(dialog).getByRole('checkbox', { name: 'Calendar' })
    ).not.toBeChecked()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Chat' }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Calendar' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await screen.findByRole('link', { name: 'Launch' })
    expect(spaces.create).toHaveBeenCalledWith({
      name: 'Launch',
      description: 'Ship it',
      color: '#46a2ff',
      apps: ['feed', 'drive', 'tasks', 'calendar']
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('offers only the apps a space can have a tab for', async () => {
    renderWithProviders(<HomeScreen />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a space' })
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Space name'), {
      target: { value: 'Launch' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }))

    expect(
      within(dialog)
        .getAllByRole('checkbox')
        .map(box => box.closest('label')?.textContent)
    ).toEqual(['Feed', 'Files', 'Chat', 'Tasks', 'Calendar', 'Mail'])
    expect(
      within(dialog).queryByRole('button', { name: 'Add shortcut' })
    ).not.toBeInTheDocument()
  })

  it('keeps the dialog open and says so when the creation fails', async () => {
    const spaces = fakeSpaces()
    vi.mocked(spaces.create).mockRejectedValue(new Error('down'))
    renderWithProviders(<HomeScreen />, { spaces })

    fireEvent.click(
      await screen.findByRole('button', { name: 'Create a space' })
    )
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Space name'), {
      target: { value: 'Launch' }
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }))
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
