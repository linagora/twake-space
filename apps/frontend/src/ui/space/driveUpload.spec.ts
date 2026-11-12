import type { Sdk } from '@linagora/twake-sdk'
import { describe, expect, it, vi } from 'vitest'

import { READY_TIMEOUT, uploadToDrive } from '@/ui/space/driveUpload'

const ORIGIN = 'https://drive.test'
const file = new File(['a'], 'a.txt')

const fetchJSON = vi.fn(() =>
  Promise.resolve({
    data: {
      id: 'i1',
      attributes: { services: [{ href: `${ORIGIN}/intents?intent=i1` }] }
    }
  })
)
const sdk = { stackClient: { fetchJSON } } as Partial<Sdk> as Sdk

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
  data: Record<string, unknown>,
  origin = ORIGIN
): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: frame.contentWindow })
  )
}

describe('uploadToDrive', () => {
  it('sends the files to the Upload intent once it is ready, in a hidden frame', async () => {
    const done = uploadToDrive(sdk, 'drive-1', [file])
    const { frame, inside } = await serviceFrame()
    expect(fetchJSON).toHaveBeenCalledWith('POST', '/intents', {
      data: expect.objectContaining({
        attributes: expect.objectContaining({
          action: 'UPLOAD',
          type: 'io.cozy.files'
        }) as unknown
      }) as unknown
    })
    expect(frame.closest('[hidden]')).not.toBeNull()
    expect(frame.src).toBe(`${ORIGIN}/intents?intent=i1`)
    const postMessage = vi.spyOn(inside, 'postMessage')

    receive(frame, { type: 'intent-i1:ready' })
    expect(postMessage).toHaveBeenCalledExactlyOnceWith(
      { driveId: 'drive-1', files: [file] },
      ORIGIN
    )

    receive(frame, { type: 'intent-i1:done', document: [] })
    await expect(done).resolves.toBeUndefined()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it.each([
    { type: 'intent-i1:error', error: { message: 'quota' } },
    { type: 'intent-i1:cancel' }
  ])('fails when the intent ends with $type', async end => {
    const done = uploadToDrive(sdk, 'drive-1', [file])
    const { frame } = await serviceFrame()

    receive(frame, { type: 'intent-i1:ready' })
    receive(frame, end)

    await expect(done).rejects.toThrow()
    expect(document.querySelector('iframe')).toBeNull()
  })

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
