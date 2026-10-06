import type { KyInstance } from 'ky'

import type { LiveHandlers, LiveService } from '@/application/live'

const MAX_DELAY_MS = 30_000
// A dropped connection that reopens at once is routine, e.g. on a network change.
const FAILURES_BEFORE_WARNING = 3

function parse(block: string): { event: string; data: unknown } | null {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }
  if (data.length === 0) return null
  try {
    return { event, data: JSON.parse(data.join('\n')) }
  } catch {
    return null
  }
}

async function read(
  body: ReadableStream<Uint8Array>,
  onEvent: LiveHandlers['onEvent']
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
    let end
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const message = parse(buffer.slice(0, end))
      buffer = buffer.slice(end + 2)
      if (message) onEvent(message.event, message.data)
    }
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

// fetch rather than EventSource, which cannot send the bearer token.
export function liveStream(api: KyInstance, retryMs = 1000): LiveService {
  return {
    subscribe({ onEvent, onReconnect }) {
      const controller = new AbortController()
      const { signal } = controller
      // A function: TypeScript would keep `signal.aborted` narrowed across awaits.
      const stopped = () => signal.aborted

      void (async () => {
        let opened = false
        let delay = retryMs
        let failures = 0
        while (!stopped()) {
          try {
            const response = await api.get('stream', {
              signal,
              timeout: false,
              headers: { accept: 'text/event-stream' }
            })
            if (opened) onReconnect()
            opened = true
            delay = retryMs
            failures = 0
            if (response.body) {
              await read(response.body, (event, data) => {
                if (!stopped()) onEvent(event, data)
              })
            }
          } catch (error) {
            if (stopped()) return
            failures += 1
            if (failures >= FAILURES_BEFORE_WARNING) {
              console.warn('Live updates interrupted:', error)
            }
          }
          await wait(delay, signal)
          delay = Math.min(delay * 2, MAX_DELAY_MS)
        }
      })()

      return () => {
        controller.abort()
      }
    }
  }
}
