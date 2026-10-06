import {
  AutoDiscovery,
  createClient,
  type ClientConfig,
  type MatrixClient
} from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { matrixSession } from '@/adapters/matrix/matrixSession'

const { findClientConfig } = vi.hoisted(() => ({ findClientConfig: vi.fn() }))

vi.mock('matrix-js-sdk', () => ({
  AutoDiscovery: {
    SUCCESS: 'SUCCESS',
    PROMPT: 'PROMPT',
    FAIL_PROMPT: 'FAIL_PROMPT',
    findClientConfig
  },
  createClient: vi.fn()
}))

const BASE_URL = 'https://matrix.acme.test/'
const KEY = 'twake-space:matrix'
const loginRequest = vi.fn()
const logout = vi.fn(() => Promise.resolve({}))
const client: Partial<MatrixClient> = {
  getSsoLoginUrl: redirect => `${BASE_URL}sso?r=${redirect}`,
  loginRequest,
  logout
}
const goTo = vi.fn()
const stored = {
  serverName: 'acme.test',
  baseUrl: BASE_URL,
  userId: '@alice:acme.test',
  accessToken: 'syt_alice',
  deviceId: 'DEVICE'
}

function discovered(found: boolean): ClientConfig {
  return {
    'm.homeserver': found
      ? { state: AutoDiscovery.SUCCESS, base_url: BASE_URL }
      : { state: AutoDiscovery.FAIL_PROMPT, base_url: null },
    'm.identity_server': { state: AutoDiscovery.PROMPT, base_url: null }
  }
}

const session = () => matrixSession(localStorage, goTo)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(createClient).mockReturnValue(client as MatrixClient)
  findClientConfig.mockResolvedValue(discovered(true))
  window.history.replaceState(null, '', '/spaces/a1/feed')
})

describe('matrixSession', () => {
  it("sends the browser to the homeserver's sign-in from its well-known", async () => {
    expect(await session().signIn('acme.test')).toBe(false)

    expect(findClientConfig).toHaveBeenCalledWith('acme.test')
    expect(createClient).toHaveBeenCalledWith({ baseUrl: BASE_URL })
    expect(goTo).toHaveBeenCalledWith(
      `${BASE_URL}sso?r=http://localhost:3000/spaces/a1/feed`
    )
  })

  it('finishes the sign-in with the login token and drops it from the address', async () => {
    window.history.replaceState(null, '', '/spaces/a1/feed?loginToken=t1&x=1')
    loginRequest.mockResolvedValue({
      user_id: '@alice:acme.test',
      access_token: 'syt_alice',
      device_id: 'DEVICE'
    })

    expect(await session().signIn('acme.test')).toBe(true)

    expect(loginRequest).toHaveBeenCalledWith({
      type: 'm.login.token',
      token: 't1',
      initial_device_display_name: 'TwakeSpace'
    })
    expect(window.location.search).toBe('?x=1')
    expect(JSON.parse(localStorage.getItem(KEY) ?? '')).toEqual(stored)
    expect(goTo).not.toHaveBeenCalled()
  })

  it('keeps the device it already signed in with', async () => {
    localStorage.setItem(KEY, JSON.stringify(stored))

    expect(await session().signIn('acme.test')).toBe(true)

    expect(findClientConfig).not.toHaveBeenCalled()
  })

  it('signs in again for another homeserver', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...stored, serverName: 'other.test' })
    )

    expect(await session().signIn('acme.test')).toBe(false)
  })

  it('refuses a homeserver its well-known does not describe', async () => {
    findClientConfig.mockResolvedValue(discovered(false))

    await expect(session().signIn('acme.test')).rejects.toThrow(/acme\.test/)
  })

  it('logs its device out and forgets it', async () => {
    localStorage.setItem(KEY, JSON.stringify(stored))

    await session().signOut()

    expect(createClient).toHaveBeenCalledWith({
      baseUrl: BASE_URL,
      userId: '@alice:acme.test',
      accessToken: 'syt_alice',
      deviceId: 'DEVICE'
    })
    expect(logout).toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('forgets its device even when the homeserver does not answer', async () => {
    localStorage.setItem(KEY, JSON.stringify(stored))
    logout.mockRejectedValueOnce(new Error('offline'))

    await session().signOut()

    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
