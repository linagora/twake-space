import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { matrixSession } from '@/adapters/matrix/matrixSession'

vi.mock('matrix-js-sdk', () => ({
  ClientEvent: { Sync: 'sync' },
  HttpApiEvent: { SessionLoggedOut: 'Session.logged_out' },
  SyncState: { Prepared: 'PREPARED' },
  createClient: vi.fn()
}))

const BASE_URL = 'https://matrix.acme.test/'
const KEY = 'twake-space:matrix'
const loginRequest = vi.fn()
const logout = vi.fn(() => Promise.resolve({}))
const listeners = new Map<string, (state?: string) => void>()
const startClient = vi.fn(() => {
  listeners.get('sync')?.('PREPARED')
  return Promise.resolve()
})
const stopClient = vi.fn()
const client: Partial<MatrixClient> = {
  getSsoLoginUrl: redirect => `${BASE_URL}sso?r=${redirect}`,
  loginRequest,
  logout,
  startClient,
  stopClient,
  on: vi.fn<MatrixClient['on']>((event, listener) => {
    listeners.set(event, listener as (state?: string) => void)
    return client as MatrixClient
  })
}
const goTo = vi.fn()
const stored = {
  baseUrl: BASE_URL,
  userId: '@alice:acme.test',
  accessToken: 'syt_alice',
  deviceId: 'DEVICE'
}

const session = () => matrixSession(localStorage, goTo)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(createClient).mockReturnValue(client as MatrixClient)
  window.history.replaceState(null, '', '/spaces/a1/feed')
})

describe('matrixSession', () => {
  it("sends the browser to the homeserver's sign-in", async () => {
    expect(await session().signIn(BASE_URL)).toBe(false)

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

    expect(await session().signIn(BASE_URL)).toBe(true)

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

    expect(await session().signIn(BASE_URL)).toBe(true)

    expect(createClient).not.toHaveBeenCalled()
  })

  it('signs in again for another homeserver', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...stored, baseUrl: 'https://matrix.other.test/' })
    )

    expect(await session().signIn(BASE_URL)).toBe(false)
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

  it('starts one client with its device and waits for the first sync', async () => {
    localStorage.setItem(KEY, JSON.stringify(stored))
    const matrix = session()

    const [first, second] = await Promise.all([
      matrix.client(),
      matrix.client()
    ])

    expect(first).toBe(client)
    expect(second).toBe(client)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith({
      baseUrl: BASE_URL,
      userId: '@alice:acme.test',
      accessToken: 'syt_alice',
      deviceId: 'DEVICE',
      timelineSupport: true
    })
  })

  it('forgets a device logged out elsewhere', async () => {
    localStorage.setItem(KEY, JSON.stringify(stored))
    startClient.mockImplementationOnce(() => {
      listeners.get('Session.logged_out')?.()
      return Promise.resolve()
    })

    await expect(session().client()).rejects.toThrow(/logged out/)

    expect(localStorage.getItem(KEY)).toBeNull()
    expect(stopClient).toHaveBeenCalled()
  })

  it('stops its client when signing out', async () => {
    localStorage.setItem(KEY, JSON.stringify(stored))
    const matrix = session()
    await matrix.client()

    await matrix.signOut()

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(stopClient).toHaveBeenCalled()
    expect(logout).toHaveBeenCalled()
  })

  it('forgets its device even when the homeserver does not answer', async () => {
    localStorage.setItem(KEY, JSON.stringify(stored))
    logout.mockRejectedValueOnce(new Error('offline'))

    await session().signOut()

    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
