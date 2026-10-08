export type AppNotification =
  | { kind: 'show'; tag: string; title: string; body: string }
  | { kind: 'close'; tag: string }

// Mirrors the `twake-embed:notification` messages of @linagora/twake-embed
// (linagora/twake-libs#21), with its bounds. To be replaced by
// `parseAppMessage` once Space moves to that release.
const MAX_TAG = 256
const MAX_TITLE = 256
const MAX_BODY = 1000

function text(value: unknown, min: number, max: number): string | null {
  return typeof value === 'string' && value.length >= min && value.length <= max
    ? value
    : null
}

export function parseAppNotification(data: unknown): AppNotification | null {
  if (typeof data !== 'object' || data === null) return null
  const m = data as Record<string, unknown>
  const tag = text(m.tag, 1, MAX_TAG)
  if (tag === null) return null
  if (m.type === 'twake-embed:notification-close') {
    return { kind: 'close', tag }
  }
  if (m.type !== 'twake-embed:notification') return null
  const title = text(m.title, 1, MAX_TITLE)
  const body = text(m.body, 0, MAX_BODY)
  return title === null || body === null
    ? null
    : { kind: 'show', tag, title, body }
}
