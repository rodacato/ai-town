import { useEffect, useRef, useState } from 'react'
import { ACTION_META } from '../../theme/actions'
import { summarize } from '../features/experiment/summary'
import { useTown } from '../store'
import { town } from '../town'

const FLUSH_MS = 2500

/** Tells screen reader users what the map shows: who decided what, batched so it never floods. */
export function LiveAnnouncer() {
  const reactions = useTown((s) => s.reactions)
  const complete = useTown((s) => s.complete)
  const announcement = useTown((s) => s.announcement)
  const [message, setMessage] = useState('')
  const told = useRef(new Set<string>())
  const queue = useRef<string[]>([])

  useEffect(() => {
    if (!announcement) told.current.clear()
  }, [announcement])

  useEffect(() => {
    for (const r of Object.values(reactions)) {
      if (r.phase !== 'decided' || !r.decision || told.current.has(r.id + r.decision.action)) continue
      told.current.add(r.id + r.decision.action)
      const name = town.content.residents.find((p) => p.id === r.id)?.name.split(' ')[0]
      queue.current.push(`${name}: ${ACTION_META[r.decision.action].label.toLowerCase()}`)
    }
  }, [reactions])

  useEffect(() => {
    const t = window.setInterval(() => {
      if (!queue.current.length) return
      setMessage(queue.current.splice(0).join('. ') + '.')
    }, FLUSH_MS)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (complete && announcement) setMessage(`Todos decidieron. ${summarize(useTown.getState().reactions, announcement).headline}.`)
  }, [complete, announcement])

  return (
    <div className="sr-only" role="status" aria-live="polite">
      {message}
    </div>
  )
}
