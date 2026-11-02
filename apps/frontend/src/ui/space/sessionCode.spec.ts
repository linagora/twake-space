import type { Sdk, SdkStatus } from '@linagora/twake-sdk'
import { describe, expect, it, vi } from 'vitest'

import { mintSessionCode, withSessionCode } from '@/ui/space/sessionCode'

function platform(
  status: SdkStatus,
  reply: () => Promise<unknown> = () =>
    Promise.resolve({ session_code: 'code-1' })
) {
  const listeners = new Set<(status: SdkStatus) => void>()
  const fetchJSON = vi.fn(reply)
  const sdk = {
    status,
    onStatusChange: (listener: (status: SdkStatus) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    fetchJSON
  }
  const become = (next: SdkStatus) => {
    sdk.status = next
    for (const listener of listeners) listener(next)
  }
  return { sdk: sdk as Partial<Sdk> as Sdk, fetchJSON, become }
}

describe('mintSessionCode', () => {
  it('asks the platform for a session code', async () => {
    const { sdk, fetchJSON } = platform('ready')
    await expect(mintSessionCode(sdk)).resolves.toBe('code-1')
    expect(fetchJSON).toHaveBeenCalledWith('/auth/session_code', {
      method: 'POST'
    })
  })

  it('waits for the platform token first', async () => {
    const { sdk, fetchJSON, become } = platform('waiting')
    const code = mintSessionCode(sdk)
    expect(fetchJSON).not.toHaveBeenCalled()
    become('ready')
    await expect(code).resolves.toBe('code-1')
  })

  it.each([
    ['without a platform', null],
    ['when the platform token is refused', platform('public').sdk],
    [
      'when the platform refuses the code',
      platform('ready', () => Promise.reject(new Error('403'))).sdk
    ],
    [
      'when the platform answers something else',
      platform('ready', () => Promise.resolve({})).sdk
    ]
  ])('gives none %s', async (_case, sdk) => {
    await expect(mintSessionCode(sdk)).resolves.toBeNull()
  })

  it('gives none once the platform token is refused', async () => {
    const { sdk, fetchJSON, become } = platform('waiting')
    const code = mintSessionCode(sdk)
    become('public')
    await expect(code).resolves.toBeNull()
    expect(fetchJSON).not.toHaveBeenCalled()
  })
})

describe('withSessionCode', () => {
  it('puts the code in the query, before the hash route', () => {
    expect(
      withSessionCode(
        'https://alice-drive.twake.test/#/embed/sharings/s%2F1/f1',
        'a b'
      )
    ).toBe(
      'https://alice-drive.twake.test/?session_code=a+b#/embed/sharings/s%2F1/f1'
    )
  })
})
