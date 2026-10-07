import { describe, expect, it } from 'vitest'

import { driveUrl } from '@/application/drive'

describe('driveUrl', () => {
  it("fills the template from the user's Twake Workplace address", () => {
    expect(
      driveUrl('https://{slug}-drive.{domain}/', 'alice.dev.twake.test')
    ).toBe('https://alice-drive.dev.twake.test/')
  })

  it('has no address without a template or a full domain name', () => {
    expect(driveUrl(null, 'alice.dev.twake.test')).toBeNull()
    expect(driveUrl('https://{slug}-drive.{domain}/', null)).toBeNull()
    expect(driveUrl('https://{slug}-drive.{domain}/', 'localhost')).toBeNull()
  })
})
