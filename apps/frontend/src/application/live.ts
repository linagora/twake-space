export interface LiveHandlers {
  onEvent: (event: string, data: unknown) => void
  /** The stream opened again: events sent while it was closed are lost. */
  onReconnect: () => void
}

export interface LiveService {
  /** Keeps a stream open until the returned function is called. */
  subscribe: (handlers: LiveHandlers) => () => void
}
