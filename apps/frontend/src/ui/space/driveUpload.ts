import type { Sdk } from '@linagora/twake-sdk'

import { Intents } from 'cozy-interapp'

export const UPLOAD_INTENT = { action: 'UPLOAD', type: 'io.cozy.files' }

// A frame that never says `ready` (Drive missing, signed out, unreachable)
// would keep the upload pending forever. Once ready, the upload takes as long
// as the files need. A first load of Drive's intent page takes about 30 s on a
// slow 3G.
export const READY_TIMEOUT = 60_000

// Drive's Upload intent stores files at the root of a shared drive:
// linagora/twake-drive/docs/upload-intent.md. The files go in reply to the
// frame's `ready`: the stack keeps intent data as JSON.
export async function uploadToDrive(
  sdk: Sdk | null,
  driveId: string,
  files: readonly File[]
): Promise<void> {
  if (!sdk) throw new Error('No platform to upload to')
  const container = document.createElement('div')
  container.hidden = true
  document.body.append(container)
  try {
    const stored = await new Intents({ client: sdk })
      .create(UPLOAD_INTENT.action, UPLOAD_INTENT.type, { driveId, files })
      .start(container, { readyTimeout: READY_TIMEOUT })
    if (stored === null) throw new Error('Drive did not store the files')
  } finally {
    container.remove()
  }
}
