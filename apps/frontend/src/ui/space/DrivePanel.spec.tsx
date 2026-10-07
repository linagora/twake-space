import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { fakeSession } from '@/testing/fakeSession'
import { renderWithProviders } from '@/testing/renderWithProviders'
import { DrivePanel } from '@/ui/space/DrivePanel'

function renderAt(
  path: string,
  driveUrlTemplate: string | null = 'https://{slug}-drive.{domain}/',
  workplaceFqdn: string | null = 'alice.twake.test'
) {
  renderWithProviders(
    <Routes>
      <Route
        path="/spaces/:spaceId/drive/*"
        element={<DrivePanel spaceId="a1" sharingId="s/1" />}
      />
    </Routes>,
    {
      path,
      driveUrlTemplate,
      session: fakeSession(() =>
        Promise.resolve({
          id: 'u-me',
          name: 'Alice Martin',
          email: 'alice@example.com',
          workplaceFqdn
        })
      )
    }
  )
}

describe('DrivePanel', () => {
  it("frames the space's shared drive on the person's own Twake Drive", async () => {
    renderAt('/spaces/a1/drive')

    expect(await screen.findByTitle('Drive')).toHaveAttribute(
      'src',
      'https://alice-drive.twake.test/embed/sharings/s%2F1'
    )
  })

  it('opens the folder the URL points at', async () => {
    renderAt('/spaces/a1/drive/folder/f1')

    expect(await screen.findByTitle('Drive')).toHaveAttribute(
      'src',
      'https://alice-drive.twake.test/embed/sharings/s%2F1/folder/f1'
    )
  })

  it.each([
    ['without a Drive address', null, 'alice.twake.test'],
    [
      "without the person's Twake Workplace",
      'https://{slug}-drive.{domain}/',
      null
    ]
  ])('says Drive is not set up %s', async (_case, template, fqdn) => {
    renderAt('/spaces/a1/drive', template, fqdn)

    expect(
      await screen.findByText('Drive is not set up for TwakeSpace.')
    ).toBeVisible()
    expect(screen.queryByTitle('Drive')).not.toBeInTheDocument()
  })
})
