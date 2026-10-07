import {
  completeLogin,
  startLogin,
  type LoginResult
} from '@linagora/twake-oidc'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { oidcSession, readSsoConfig } from '@/adapters/oidc/oidcSession'

vi.mock('@linagora/twake-oidc', () => ({
  configureAuth: vi.fn(),
  completeLogin: vi.fn(),
  startLogin: vi.fn(() => Promise.resolve()),
  logOut: vi.fn(),
  onSessionEndedElsewhere: vi.fn()
}))

const settings = {
  SSO_BASE_URL: 'https://sso.test/',
  SSO_CLIENT_ID: 'twakespace',
  SSO_SCOPE: 'openid email profile',
  SSO_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  SSO_POST_LOGOUT_REDIRECT: 'http://localhost:3000/'
}

const config = readSsoConfig(settings, 'http://localhost:3000')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('readSsoConfig', () => {
  it('refuses missing settings', () => {
    expect(() =>
      readSsoConfig({ ...settings, SSO_CLIENT_ID: '' }, 'http://localhost')
    ).toThrow(/SSO_CLIENT_ID/)
  })
})

describe('oidcSession', () => {
  it('finishes the sign-in on the redirect URI and goes back', async () => {
    window.history.replaceState(null, '', '/auth/callback?code=c&state=s')
    const userinfo: LoginResult['userinfo'] = {
      sub: 'alice',
      uuid: 'uuid-alice',
      name: 'Alice Martin',
      workplaceFqdn: 'alice.twake.test'
    }
    vi.mocked(completeLogin).mockResolvedValue({
      userinfo,
      returnTo: '/spaces?tab=2'
    } as LoginResult)

    const user = await oidcSession(config).start()

    expect(user).toEqual({
      id: 'uuid-alice',
      name: 'Alice Martin',
      email: null,
      workplaceFqdn: 'alice.twake.test'
    })
    expect(window.location.pathname + window.location.search).toBe(
      '/spaces?tab=2'
    )
    expect(startLogin).not.toHaveBeenCalled()
  })

  it('signs in again when the redirect URI has no pending sign-in', async () => {
    window.history.replaceState(null, '', '/auth/callback')
    vi.mocked(completeLogin).mockResolvedValue(null)

    await expect(oidcSession(config).start()).resolves.toBeNull()
    expect(startLogin).toHaveBeenCalled()
  })

  it('sends the user to the SSO from any other page', async () => {
    window.history.replaceState(null, '', '/spaces')

    await expect(oidcSession(config).start()).resolves.toBeNull()
    expect(completeLogin).not.toHaveBeenCalled()
    expect(startLogin).toHaveBeenCalled()
  })
})
