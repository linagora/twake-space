import type { Sdk } from '@linagora/twake-sdk'
import { describe, expect, it, vi } from 'vitest'

import {
  READY_TIMEOUT,
  UPLOAD_INTENT,
  uploadToDrive
} from '@/ui/space/driveUpload'

const ORIGIN = 'https://drive.test'
const file = new File(['a'], 'a.txt')

const createIntent = vi.fn(() =>
  Promise.resolve({
    id: 'i1',
    action: 'UPLOAD',
    type: 'io.cozy.files',
    services: [{ slug: 'drive', href: `${ORIGIN}/intents?intent=i1` }]
  })
)
const sdk = { createIntent } as Partial<Sdk> as Sdk

function serviceFrame(): Promise<{ frame: HTMLIFrameElement; inside: Window }> {
  return vi.waitFor(() => {
    const frame = document.querySelector('iframe')
    const inside = frame?.contentWindow
    if (!frame || !inside) throw new Error('No frame yet')
    return { frame, inside }
  })
}

function receive(
  frame: HTMLIFrameElement,
  type: string,
  origin = ORIGIN
): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type },
      origin,
      source: frame.contentWindow
    })
  )
}

describe('uploadToDrive', () => {
  it('sends the files to the Upload intent once it is ready, in a hidden frame', async () => {
    const done = uploadToDrive(sdk, 'drive-1', [file])
    const { frame, inside } = await serviceFrame()
    expect(createIntent).toHaveBeenCalledWith(UPLOAD_INTENT)
    expect(frame.hidden).toBe(true)
    expect(frame.src).toBe(`${ORIGIN}/intents?intent=i1`)
    const postMessage = vi.spyOn(inside, 'postMessage')

    receive(frame, 'intent-i1:ready', 'https://elsewhere.test')
    expect(postMessage).not.toHaveBeenCalled()
    receive(frame, 'intent-i1:ready')
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      { driveId: 'drive-1', files: [file] },
      ORIGIN
    )
    receive(frame, 'intent-i1:ready')

    receive(frame, 'intent-i1:done')
    await expect(done).resolves.toBeUndefined()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it.each(['error', 'cancel'])(
    'fails when the intent ends with %s',
    async end => {
      const done = uploadToDrive(sdk, 'drive-1', [file])
      const { frame } = await serviceFrame()

      receive(frame, `intent-i1:${end}`)

      await expect(done).rejects.toThrow()
      expect(document.querySelector('iframe')).toBeNull()
    }
  )

  it('fails when the intent never gets ready', async () => {
    vi.useFakeTimers()
    try {
      const failed = uploadToDrive(sdk, 'drive-1', [file]).then(
        () => false,
        () => true
      )
      await vi.waitFor(() => {
        expect(document.querySelector('iframe')).not.toBeNull()
      })

      await vi.advanceTimersByTimeAsync(READY_TIMEOUT)

      expect(await failed).toBe(true)
      expect(document.querySelector('iframe')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails without a platform', async () => {
    await expect(uploadToDrive(null, 'drive-1', [file])).rejects.toThrow()
  })
})
