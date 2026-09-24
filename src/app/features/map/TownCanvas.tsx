import { useEffect, useRef, useState } from 'react'
import { town } from '../../town'
import './map.css'

const STEP = 90
const PAN: Record<string, [number, number]> = { ArrowLeft: [STEP, 0], ArrowRight: [-STEP, 0], ArrowUp: [0, STEP], ArrowDown: [0, -STEP] }

/** The map. It takes focus like any control: arrows move it, N and P walk through the residents and say what each is doing. */
export function TownCanvas() {
  const host = useRef<HTMLDivElement>(null)
  const [said, setSaid] = useState('')
  useEffect(() => town.mount(host.current!), [])
  const onKey = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const pan = PAN[e.key]
    if (pan) {
      e.preventDefault()
      return town.panBy(...pan)
    }
    const key = e.key.toLowerCase()
    if (key === 'n' || key === 'p') {
      e.preventDefault()
      setSaid(town.cycleResident(key === 'n' ? 1 : -1) ?? 'No queda nadie en el pueblo.')
    }
  }
  return (
    <>
      <div
        ref={host}
        className="town-canvas"
        tabIndex={0}
        role="application"
        aria-roledescription="mapa"
        aria-label={`Mapa de ${town.content.name}`}
        aria-describedby="map-keys"
        onKeyDown={onKey}
      />
      <p id="map-keys" className="sr-only">
        Flechas para mover el mapa, más y menos para acercar o alejar, cero para ver todo el pueblo. N y P recorren a los vecinos: abren su ficha y dicen dónde están y qué hacen.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </>
  )
}
