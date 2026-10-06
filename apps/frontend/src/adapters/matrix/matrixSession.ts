import type { MatrixClient } from 'matrix-js-sdk'

import type { MatrixService } from '@/application/matrix'

// Loaded on first use: it would double the startup bundle.
const sdk = () => import('matrix-js-sdk')

const KEY = 'twake-space:matrix'

interface Device {
  baseUrl: string
  userId: string
  accessToken: string
  deviceId: string
}

function isDevice(value: unknown): value is Device {
  if (typeof value !== 'object' || value === null) return false
  return ['baseUrl', 'userId', 'accessToken', 'deviceId'].every(
    key => typeof (value as Record<string, unknown>)[key] === 'string'
  )
}

export function matrixSession(
  storage: Storage,
  goTo: (url: string) => void = url => {
    window.location.assign(url)
  }
): MatrixService & {
  /** The signed-in client, synced once. */
  client: () => Promise<MatrixClient>
} {
  const stored = (): Device | null => {
    try {
      const value: unknown = JSON.parse(storage.getItem(KEY) ?? 'null')
      return isDevice(value) ? value : null
    } catch {
      return null
    }
  }

  let started: Promise<MatrixClient> | null = null

  async function start(): Promise<MatrixClient> {
    const device = stored()
    if (!device) throw new Error('not signed in to Matrix')
    const { createClient, ClientEvent, HttpApiEvent, SyncState } = await sdk()
    const { baseUrl, userId, accessToken, deviceId } = device
    const client = createClient({
      baseUrl,
      userId,
      accessToken,
      deviceId,
      timelineSupport: true
    })
    const synced = new Promise<void>((resolve, reject) => {
      client.on(ClientEvent.Sync, state => {
        if (state === SyncState.Prepared) resolve()
      })
      // Logged out elsewhere: the next sign-in gets a new device.
      client.on(HttpApiEvent.SessionLoggedOut, () => {
        storage.removeItem(KEY)
        started = null
        client.stopClient()
        reject(new Error('the Matrix device was logged out'))
      })
    })
    await client.startClient({ initialSyncLimit: 20, lazyLoadMembers: true })
    await synced
    return client
  }

  return {
    async signIn(baseUrl) {
      if (stored()?.baseUrl === baseUrl) return true

      const { createClient } = await sdk()
      const homeserver = createClient({ baseUrl })
      const here = new URL(window.location.href)
      const token = here.searchParams.get('loginToken')
      if (!token) {
        goTo(homeserver.getSsoLoginUrl(here.href))
        return false
      }

      // A login token works once: drop it before a reload replays it.
      here.searchParams.delete('loginToken')
      window.history.replaceState(window.history.state, '', here)
      const login = await homeserver.loginRequest({
        type: 'm.login.token',
        token,
        initial_device_display_name: 'TwakeSpace'
      })
      const device: Device = {
        baseUrl,
        userId: login.user_id,
        accessToken: login.access_token,
        deviceId: login.device_id
      }
      storage.setItem(KEY, JSON.stringify(device))
      return true
    },
    client() {
      started ??= start().catch((error: unknown) => {
        started = null
        throw error
      })
      return started
    },
    async signOut() {
      const device = stored()
      storage.removeItem(KEY)
      const running = started
      started = null
      if (!device) return
      const { baseUrl, userId, accessToken, deviceId } = device
      try {
        const { createClient } = await sdk()
        const client =
          (await running?.catch(() => null)) ??
          createClient({ baseUrl, userId, accessToken, deviceId })
        client.stopClient()
        await client.logout()
      } catch {
        // The device stays on the homeserver until its admin removes it.
      }
    }
  }
}
