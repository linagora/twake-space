import type { Sdk } from '@linagora/twake-sdk'

export const UPLOAD_INTENT = { action: 'UPLOAD', type: 'io.cozy.files' }

// A frame that never says `ready` (Drive missing, signed out, unreachable)
// would keep the upload pending forever. Once ready, the upload takes as long
// as the files need.
export const READY_TIMEOUT = 30_000

// Drive's Upload intent stores files at the root of a shared drive:
// linagora/twake-drive/docs/upload-intent.md. The files go in reply to the
// frame's `ready`: the stack keeps intent data as JSON.
export async function uploadToDrive(
  sdk: Sdk | null,
  driveId: string,
  files: readonly File[]
): Promise<void> {
  if (!sdk) throw new Error('No platform to upload to')
  const intent = await sdk.createIntent(UPLOAD_INTENT)
  const href = intent.services[0]?.href
  if (href === undefined) throw new Error('No service for the Upload intent')
  const origin = new URL(href).origin
  const frame = document.createElement('iframe')
  frame.hidden = true
  frame.src = href
  const listening = new AbortController()
  let waiting: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      waiting = setTimeout(() => {
        reject(new Error('The Upload intent never got ready'))
      }, READY_TIMEOUT)
      window.addEventListener(
        'message',
        event => {
          if (event.origin !== origin || event.source !== frame.contentWindow) {
            return
          }
          const data: unknown = event.data
          if (typeof data !== 'object' || data === null || !('type' in data)) {
            return
          }
          // A second `ready` (the frame reloaded) would store the files twice
          if (data.type === `intent-${intent.id}:ready`) {
            if (waiting === undefined) return
            clearTimeout(waiting)
            waiting = undefined
            frame.contentWindow?.postMessage({ driveId, files }, origin)
          } else if (data.type === `intent-${intent.id}:done`) {
            resolve()
          } else if (
            data.type === `intent-${intent.id}:error` ||
            data.type === `intent-${intent.id}:cancel`
          ) {
            reject(new Error('Drive did not store the files', { cause: data }))
          }
        },
        { signal: listening.signal }
      )
      document.body.append(frame)
    })
  } finally {
    clearTimeout(waiting)
    listening.abort()
    frame.remove()
  }
}
