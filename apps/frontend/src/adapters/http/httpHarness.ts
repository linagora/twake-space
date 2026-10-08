import { getAccessToken } from '@linagora/twake-oidc'
import ky, { HTTPError } from 'ky'

import type { HarnessService } from '@/application/suggestions'

// Not `backend`: its hook adds the token for the API origin only.
export function httpHarness(harnessUrl: string): HarnessService {
  const harness = ky.create({
    prefixUrl: harnessUrl,
    retry: 0,
    hooks: {
      beforeRequest: [
        request => {
          const token = getAccessToken()
          if (token) request.headers.set('Authorization', `Bearer ${token}`)
        }
      ]
    }
  })
  const answer = async (
    pendingCallId: string,
    action: 'approve' | 'refuse',
    json?: object
  ) => {
    try {
      await harness.post(
        `v1/pending-calls/${encodeURIComponent(pendingCallId)}/${action}`,
        { json }
      )
    } catch (error) {
      // 409: answered already, from elsewhere.
      if (!(error instanceof HTTPError && error.response.status === 409)) {
        throw error
      }
    }
  }
  return {
    approve: id => answer(id, 'approve'),
    refuse: (id, reason) => answer(id, 'refuse', { reason })
  }
}
