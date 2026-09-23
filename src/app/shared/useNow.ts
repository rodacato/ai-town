import { useEffect, useState } from 'react'

export function useNow(active: boolean, intervalMs = 200) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(performance.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [active, intervalMs])
  return now
}
