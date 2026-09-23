import { useEffect, useRef } from 'react'
import { TownRenderer } from '../../../render/TownRenderer'
import { MAP_INSETS, useTown } from '../../store'

export function TownCanvas() {
  const host = useRef<HTMLDivElement>(null)
  const sim = useTown((s) => s.sim)
  const engine = useTown((s) => s.engine)

  useEffect(() => {
    const el = host.current!
    const { setHovered, setSelected, setRenderer, syncClock, markInteracted } = useTown.getState()
    let disposed = false
    let instance: TownRenderer | null = null
    TownRenderer.create(el, sim, engine, { onHover: setHovered, onSelect: setSelected }, { insets: () => MAP_INSETS }).then((r) => {
      if (disposed) return r.destroy()
      instance = r
      r.camera.onInteract = markInteracted
      setRenderer(r)
    })
    syncClock()
    const clock = window.setInterval(syncClock, 1000)
    return () => {
      disposed = true
      window.clearInterval(clock)
      instance?.destroy()
      setRenderer(null)
    }
  }, [sim, engine])

  return <div ref={host} className="town-canvas" />
}
