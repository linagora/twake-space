export interface Stream {
  sessionId: string
  close: () => void
}

export function createStreams() {
  const open = new Set<Stream>()
  return {
    add(stream: Stream) {
      open.add(stream)
      return () => open.delete(stream)
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
