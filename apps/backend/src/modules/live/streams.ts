export type LiveEvent = 'notification' | 'spaces' | 'settings' | 'feed'

export interface Stream {
  sessionId: string
  userId: string
  email: string
  send: (event: LiveEvent, data: object) => void
  close: () => void
}

// Enough for every tab a person keeps open; past it, the oldest are left over.
const STREAMS_PER_PERSON = 10

export function createStreams() {
  const byPerson = new Map<string, Set<Stream>>()
  const remove = (stream: Stream) => {
    const own = byPerson.get(stream.userId)
    own?.delete(stream)
    if (own?.size === 0) byPerson.delete(stream.userId)
  }
  const all = () => [...byPerson.values()].flatMap(own => [...own])
  return {
    add(stream: Stream) {
      const own = byPerson.get(stream.userId) ?? new Set()
      byPerson.set(stream.userId, own)
      own.add(stream)
      const [oldest] = own
      if (oldest && own.size > STREAMS_PER_PERSON) {
        remove(oldest)
        oldest.close()
      }
      return () => {
        remove(stream)
      }
    },
    send(userId: string, event: LiveEvent, data: object) {
      for (const stream of byPerson.get(userId) ?? []) stream.send(event, data)
    },
    // Common settings knows people by email only.
    sendToEmail(email: string, event: LiveEvent, data: object) {
      const lowercased = email.toLowerCase()
      for (const stream of all()) {
        if (stream.email.toLowerCase() === lowercased) stream.send(event, data)
      }
    },
    closeSession(sessionId: string) {
      for (const stream of all()) {
        if (stream.sessionId === sessionId) stream.close()
      }
    },
    closeAll() {
      for (const stream of all()) stream.close()
    }
  }
}

export type Streams = ReturnType<typeof createStreams>
