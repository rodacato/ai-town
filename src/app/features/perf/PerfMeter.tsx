import { useEffect, useState } from 'react'
import type { FrameStats } from '../../../render/frameStats'
import { useTown } from '../../store'
import { town } from '../../town'
import './perf.css'

/** Shown with ?perf in the address: how fast the town runs on this device, to check phones or high speeds. */
export const perfWanted = () => new URLSearchParams(location.search).has('perf')

interface Heap {
  usedJSHeapSize: number
}

export function PerfMeter() {
  const speed = useTown((s) => s.speed)
  const [stats, setStats] = useState<FrameStats | null>(null)
  const [heap, setHeap] = useState<number | null>(null)
  useEffect(() => {
    const t = window.setInterval(() => {
      setStats(town.frameStats())
      const memory = (performance as Performance & { memory?: Heap }).memory
      setHeap(memory ? memory.usedJSHeapSize / 1048576 : null)
    }, 500)
    return () => window.clearInterval(t)
  }, [])
  if (!stats) return null
  const ms = (v: number) => `${v.toFixed(1)} ms`
  const rows: [string, string][] = [
    ['Velocidad', `×${speed}`],
    ['Cuadros/s', stats.fps.toFixed(0)],
    ['Cuadro p95', ms(stats.frameP95)],
    ['Lógica p50', ms(stats.logicP50)],
    ['Dibujo p50', ms(stats.renderP50)],
    ['Objetos', String(stats.objects)],
    ...(heap !== null ? [['Memoria', `${heap.toFixed(0)} MB`] as [string, string]] : []),
  ]
  return (
    <aside className="perf-meter panel" aria-label="Rendimiento">
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
