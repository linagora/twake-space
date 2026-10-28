import { useEffect, useState } from 'react'

// setTimeout fires at once for a delay past 2^31 - 1 ms (about 24.8 days).
const MAX_TIMER_MS = 2 ** 31 - 1

export function useNowAfter(at: number): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!Number.isFinite(at) || at <= now) return
    const timer = setTimeout(
      () => {
        setNow(Date.now())
      },
      Math.min(at - Date.now(), MAX_TIMER_MS)
    )
    return () => {
      clearTimeout(timer)
    }
  }, [at, now])
  return now
}
