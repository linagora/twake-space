export type LiveEvent = 'notification' | 'spaces'

export interface Stream {
  sessionId: string
  userId: string
  send: (event: LiveEvent, data: object) => void
  close: () => void
}

export function createStreams() {
  const open = new Set<Stream>()
  return {
    add(stream: Stream) {
      open.add(stream)
      return () => open.delete(stream)
    },
    send(userId: string, event: LiveEvent, data: object) {
      for (const stream of open) {
        if (stream.userId === userId) stream.send(event, data)
      }
    },
    closeSession(sessionId: string) {
      for (const stream of open) {
        if (stream.sessionId === sessionId) stream.close()
      }
    },
    closeAll() {
      for (const stream of open) stream.close()
    }
  }
}

export type Streams = ReturnType<typeof createStreams>
