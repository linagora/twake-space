import type { UploadMessage } from '@linagora/twake-embed'
import { describe, expect, it, vi } from 'vitest'

import { createAppUploads } from '@/ui/space/AppUploads'

const file = new File(['a'], 'a.txt')

describe('createAppUploads', () => {
  it('posts the files to the frame of the app, and hears its answer', async () => {
    const uploads = createAppUploads()
    const postMessage =
      vi.fn<(message: UploadMessage, origin?: unknown) => void>()
    uploads.attach('drive', { postMessage }, 'https://drive.test')

    const done = uploads.upload('drive', 'drive-1', [file])
    const [[message, origin]] = postMessage.mock.calls as [
      [UploadMessage, unknown]
    ]
    expect(origin).toBe('https://drive.test')
    expect(message).toMatchObject({
      type: 'twake-embed:upload',
      resourceId: 'drive-1',
      files: [file]
    })

    // Another app cannot answer for it
    uploads.settle('tasks', message.id, false)
    uploads.settle('drive', message.id, true)
    await expect(done).resolves.toBeUndefined()
  })

  it('sends more than 100 files in turns', async () => {
    const uploads = createAppUploads()
    const postMessage = vi.fn((message: UploadMessage) => {
      queueMicrotask(() => {
        uploads.settle('drive', message.id, true)
      })
    })
    uploads.attach('drive', { postMessage }, 'https://drive.test')

    await uploads.upload(
      'drive',
      'drive-1',
      Array.from({ length: 150 }, () => file)
    )

    expect(
      postMessage.mock.calls.map(([message]) => message.files.length)
    ).toEqual([100, 50])
  })

  it('fails without a frame, on a refusal, and when the frame goes', async () => {
    const uploads = createAppUploads()
    await expect(uploads.upload('drive', 'drive-1', [file])).rejects.toThrow()

    const postMessage = vi.fn<(message: UploadMessage) => void>()
    const detach = uploads.attach(
      'drive',
      { postMessage },
      'https://drive.test'
    )
    const refused = uploads.upload('drive', 'drive-1', [file])
    const [[message]] = postMessage.mock.calls as [[UploadMessage]]
    uploads.settle('drive', message.id, false)
    await expect(refused).rejects.toThrow()

    const unanswered = uploads.upload('drive', 'drive-1', [file])
    detach()
    await expect(unanswered).rejects.toThrow()
    await expect(uploads.upload('drive', 'drive-1', [file])).rejects.toThrow()
  })
})
