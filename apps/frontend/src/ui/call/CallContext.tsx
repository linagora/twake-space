import { createContext, use, useMemo, useState, type ReactNode } from 'react'

export interface Call {
  // A Meet room
  url: string
}

interface CallApi {
  call: Call | null
  join: (call: Call) => void
  leave: () => void
}

const CallContext = createContext<CallApi | null>(null)

// One call at a time: joining another room leaves the current one.
export function CallProvider({ children }: { children: ReactNode }): ReactNode {
  const [call, setCall] = useState<Call | null>(null)
  const api = useMemo(
    () => ({
      call,
      join: setCall,
      leave: () => {
        setCall(null)
      }
    }),
    [call]
  )
  return <CallContext value={api}>{children}</CallContext>
}

export function useCall(): CallApi {
  const api = use(CallContext)
  if (!api) throw new Error('useCall must be used inside CallProvider')
  return api
}
