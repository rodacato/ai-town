import { useEffect, useState } from 'react'
import { useTown } from '../store'

export function MapHint() {
  const ready = useTown((s) => s.ready)
  const interacted = useTown((s) => s.interacted)
  const selected = useTown((s) => !!s.selectedId)
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setExpired(true), 12000)
    return () => window.clearTimeout(t)
  }, [])
  const visible = ready && !interacted && !expired && !selected
  return (
    <div className={`map-hint ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <span><kbd>Arrastra</kbd> para moverte</span>
      <span className="sep" />
      <span><kbd>Rueda</kbd> para acercar</span>
      <span className="sep" />
      <span><kbd>Clic</kbd> en un residente</span>
    </div>
  )
}
