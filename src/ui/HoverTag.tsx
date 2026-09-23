import { useEffect, useRef } from 'react'
import { RESIDENTS } from '../data/residents'
import { useTown } from '../store'

export function HoverTag() {
  const hoveredId = useTown((s) => s.hoveredId)
  const selectedId = useTown((s) => s.selectedId)
  const renderer = useTown((s) => s.renderer)
  const ref = useRef<HTMLDivElement>(null)
  const id = hoveredId && hoveredId !== selectedId ? hoveredId : null
  const profile = RESIDENTS.find((r) => r.id === id)

  useEffect(() => {
    if (!id || !renderer) return
    let raf = 0
    const follow = () => {
      const p = renderer.residentScreenPosition(id)
      const el = ref.current
      if (p && el) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`
      raf = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(raf)
  }, [id, renderer])

  return (
    <div ref={ref} className={`hover-tag ${profile ? 'is-visible' : ''}`}>
      {profile && (
        <>
          <strong>{profile.name.split(' ')[0]}</strong>
          <span>{profile.occupation}</span>
        </>
      )}
    </div>
  )
}
