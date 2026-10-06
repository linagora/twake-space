import { addAuthorization, redirectOnUnauthorized } from '@linagora/twake-oidc'
import ky, { type KyInstance } from 'ky'

export function backend(apiUrl: string): KyInstance {
  return ky.create({
    prefixUrl: apiUrl,
    retry: 0,
    hooks: {
      beforeRequest: [addAuthorization],
      afterResponse: [redirectOnUnauthorized],
      // A Refusal: the query client retries server errors only, and the UI
      // explains a refused write by its code.
      beforeError: [
        async error => {
          const body: unknown = await error.response
            .clone()
            .json()
            .catch(() => null)
          const code =
            typeof body === 'object' &&
            body !== null &&
            'error' in body &&
            typeof body.error === 'string'
              ? body.error
              : null
          return Object.assign(error, { status: error.response.status, code })
        }
      ]
    }
  })
}
