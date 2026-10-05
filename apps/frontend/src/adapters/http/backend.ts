import { addAuthorization, redirectOnUnauthorized } from '@linagora/twake-oidc'
import ky, { type KyInstance } from 'ky'

export function backend(apiUrl: string): KyInstance {
  return ky.create({
    prefixUrl: apiUrl,
    retry: 0,
    hooks: {
      beforeRequest: [addAuthorization],
      afterResponse: [redirectOnUnauthorized],
      // The query client reads the status to retry server errors only.
      beforeError: [
        error => Object.assign(error, { status: error.response.status })
      ]
    }
  })
}
