import { useEffect, useState } from 'react'
import { useTown } from '../store'
import { TownMark } from '../shared/icons'
import { town } from '../town'

export function Loader() {
  const ready = useTown((s) => s.ready)
  const [fonts, setFonts] = useState(false)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    document.fonts.ready.then(() => setFonts(true))
  }, [])
  const done = ready && fonts
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setGone(true), 900)
    return () => window.clearTimeout(t)
  }, [done])
  if (gone) return null
  return (
    <div className={`loader ${done ? 'is-done' : ''}`} role="status" aria-live="polite">
      <div className="loader-mark">
        <TownMark size={56} />
      </div>
      <p className="loader-title">{town.content.name}</p>
      <p className="loader-sub">Despertando al pueblo…</p>
      <div className="loader-bar">
        <span />
      </div>
    </div>
  )
}
