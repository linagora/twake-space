const SLUG = /^([a-z]{3})-?([a-z]{4})-?([a-z]{3})$/

// The room a pasted text names: a link to a room on this Meet, or the room's
// 10-letter code, with or without its dashes. Null for anything else.
export function meetRoomUrl(text: string, meetUrl: string): string | null {
  const base = meetUrl.replace(/\/+$/, '')
  let code = text.trim().toLowerCase()
  if (code.startsWith(`${base.toLowerCase()}/`)) {
    code = code.slice(base.length + 1).replace(/\/?([?#].*)?$/, '')
  }
  const parts = SLUG.exec(code)
  return parts ? `${base}/${parts.slice(1).join('-')}` : null
}
