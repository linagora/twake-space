import type { MatrixService } from '@/application/matrix'

// Loaded on first use: it would double the startup bundle.
const sdk = () => import('matrix-js-sdk')

const KEY = 'twake-space:matrix'

interface Device {
  serverName: string
  baseUrl: string
  userId: string
  accessToken: string
  deviceId: string
}

function isDevice(value: unknown): value is Device {
  if (typeof value !== 'object' || value === null) return false
  return ['serverName', 'baseUrl', 'userId', 'accessToken', 'deviceId'].every(
    key => typeof (value as Record<string, unknown>)[key] === 'string'
  )
}

async function baseUrlOf(serverName: string): Promise<string> {
  const { AutoDiscovery } = await sdk()
  const config = await AutoDiscovery.findClientConfig(serverName)
  const homeserver = config['m.homeserver']
  if (homeserver.state !== AutoDiscovery.SUCCESS || !homeserver.base_url) {
    throw new Error(`no Matrix homeserver found for ${serverName}`)
  }
  return homeserver.base_url
}

export function matrixSession(
  storage: Storage,
  goTo: (url: string) => void = url => {
    window.location.assign(url)
  }
): MatrixService {
  const stored = (): Device | null => {
    try {
      const value: unknown = JSON.parse(storage.getItem(KEY) ?? 'null')
      return isDevice(value) ? value : null
    } catch {
      return null
    }
  }

  return {
    async signIn(serverName) {
      if (stored()?.serverName === serverName) return true

      const baseUrl = await baseUrlOf(serverName)
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
        serverName,
        baseUrl,
        userId: login.user_id,
        accessToken: login.access_token,
        deviceId: login.device_id
      }
      storage.setItem(KEY, JSON.stringify(device))
      return true
    },
    async signOut() {
      const device = stored()
      storage.removeItem(KEY)
      if (!device) return
      const { baseUrl, userId, accessToken, deviceId } = device
      try {
        const { createClient } = await sdk()
        await createClient({ baseUrl, userId, accessToken, deviceId }).logout()
      } catch {
        // The device stays on the homeserver until its admin removes it.
      }
    }
  }
}
