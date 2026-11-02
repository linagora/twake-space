import type { Sdk } from '@linagora/twake-sdk'

// A session code opens a session on the person's platform for the app URL it
// is put on (cozy-stack docs/auth.md, POST /auth/session_code), which the
// token of the platform may mint. Null when it cannot be had: the app then
// signs in on its own.
export async function mintSessionCode(sdk: Sdk | null): Promise<string | null> {
  if (!sdk) return null
  if (sdk.status === 'waiting') {
    await new Promise<void>(resolve => {
      const stop = sdk.onStatusChange(status => {
        if (status === 'waiting') return
        stop()
        resolve()
      })
    })
  }
  if (sdk.status !== 'ready') return null
  try {
    const { session_code: code } = await sdk.fetchJSON<{
      session_code?: unknown
    }>('/auth/session_code', { method: 'POST' })
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

export function withSessionCode(src: string, code: string): string {
  const url = new URL(src)
  url.searchParams.set('session_code', code)
  return url.href
}
