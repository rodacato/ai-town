import { useEffect, useRef } from 'react'
import { useTown } from '../../store'
import { town } from '../../town'
import { firstName } from '../../../core/lang'

export function HoverTag() {
  const hoveredId = useTown((s) => s.hoveredId)
  const selectedId = useTown((s) => s.selectedId)
  const ready = useTown((s) => s.ready)
  const ref = useRef<HTMLDivElement>(null)
  const id = hoveredId && hoveredId !== selectedId ? hoveredId : null
  const profile = town.content.residents.find((r) => r.id === id)

  useEffect(() => {
    if (!id || !ready) return
    let raf = 0
    const follow = () => {
      const p = town.residentScreenPosition(id)
      const el = ref.current
      if (p && el) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`
      raf = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(raf)
  }, [id, ready])

  return (
    <div ref={ref} className={`hover-tag ${profile ? 'is-visible' : ''}`}>
      {profile && (
        <>
          <strong>{firstName(profile.name)}</strong>
          <span>{profile.occupation}</span>
        </>
      )}
    </div>
  )
}
