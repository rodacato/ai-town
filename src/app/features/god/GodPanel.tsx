import { useEffect, useRef, useState } from 'react'
import type { OutcomeVisual } from '../../../core/reactions/outcome'
import { formatClock } from '../../../core/sim/clock'
import { WEATHERS, WEATHER_TEXT, type Weather } from '../../../core/sim/weather'
import { useTown } from '../../store'
import { Bolt, Close } from '../../shared/icons'
import { town } from '../../town'
import './god.css'

const HOURS: [string, number][] = [
  ['Amanecer', 6.5],
  ['Mediodía', 12],
  ['Atardecer', 18.5],
  ['Noche', 22],
]
const SPEEDS: [string, number][] = [
  ['Pausa', 0],
  ['×1', 1],
  ['×2', 2],
  ['×4', 4],
]
const WEATHER_ICON: Record<Weather, string> = { clear: '☀️', rain: '🌧️', storm: '⛈️', snow: '❄️', fog: '🌫️' }
/** What can be unleashed and where it happens unless the user picks a place. */
const EVENTS: { visual: OutcomeVisual; icon: string; label: string; place: string }[] = [
  { visual: 'fire', icon: '🐉', label: 'Dragón', place: 'forest' },
  { visual: 'monster', icon: '👹', label: 'Bestia', place: 'bridge' },
  { visual: 'feast', icon: '🍖', label: 'Festín', place: 'plaza' },
  { visual: 'treasure', icon: '💰', label: 'Tesoro', place: 'crypt' },
]

export function GodPanel() {
  const open = useTown((s) => s.godOpen)
  if (!open) return null
  return <Drawer />
}

function Drawer() {
  const { minutes, speed, weather, godEvent, curfew, setGodOpen } = useTown()
  const [place, setPlace] = useState('auto')
  const ref = useRef<HTMLElement>(null)
  const places = town.sim.world.places.filter((p) => p.keywords.length && p.spots.length)
  const { day, time } = formatClock(minutes)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ref.current?.contains(document.activeElement) && setGodOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setGodOpen])

  return (
    <aside className="god-panel panel" ref={ref} aria-label="Modo dios">
      <header className="god-head">
        <h2>
          <Bolt width={18} height={18} /> Modo dios
        </h2>
        <button className="icon-btn" onClick={() => setGodOpen(false)} aria-label="Cerrar modo dios">
          <Close />
        </button>
      </header>
      <p className="god-intro">Cambia el mundo al instante para probar cómo reaccionan los residentes.</p>

      <section>
        <h3 className="section-label">
          Tiempo{' '}
          <span className="mono god-clock">
            {day} {time}
          </span>
        </h3>
        <div className="god-grid four">
          {HOURS.map(([label, hour]) => (
            <button key={label} className="god-btn" onClick={() => town.setHour(hour)}>
              {label}
            </button>
          ))}
        </div>
        <div className="segmented four" role="radiogroup" aria-label="Velocidad del pueblo" style={{ ['--active' as string]: SPEEDS.findIndex(([, v]) => v === speed) }}>
          <span className="segmented-thumb" aria-hidden />
          {SPEEDS.map(([label, v]) => (
            <button key={label} role="radio" aria-checked={speed === v} className={speed === v ? 'is-active' : ''} onClick={() => town.setSpeed(v)}>
              {label}
            </button>
          ))}
        </div>
        <p className="field-hint">La velocidad mueve al pueblo; los modelos piensan a su ritmo.</p>
      </section>

      <section>
        <h3 className="section-label">Clima</h3>
        <div className="god-grid five" role="radiogroup" aria-label="Clima">
          {WEATHERS.map((w) => (
            <button key={w} role="radio" aria-checked={weather === w} className={`god-btn stacked ${weather === w ? 'is-active' : ''}`} onClick={() => town.setWeather(w)}>
              <span aria-hidden>{WEATHER_ICON[w]}</span>
              {WEATHER_TEXT[w].label}
            </button>
          ))}
        </div>
        <p className="field-hint">Los residentes lo notan: el clima entra en lo que el modelo sabe.</p>
      </section>

      <section>
        <h3 className="section-label">Desatar</h3>
        <label className="field god-place">
          <span className="field-label">¿Dónde?</span>
          <select className="input" value={place} onChange={(e) => setPlace(e.target.value)}>
            <option value="auto">Donde tenga sentido</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="god-grid four">
          {EVENTS.map((e) => (
            <button key={e.visual} className="god-btn stacked" onClick={() => town.unleash(e.visual, place === 'auto' ? e.place : place)}>
              <span aria-hidden>{e.icon}</span>
              {e.label}
            </button>
          ))}
        </div>
        {godEvent && (
          <button className="btn-link" onClick={() => town.clearEvent()}>
            Quitar «{godEvent.summary.replace(/\.$/, '')}»
          </button>
        )}
      </section>

      <section>
        <h3 className="section-label">Pueblo</h3>
        <div className="god-actions">
          <button className="god-btn" onClick={() => town.gather(place === 'auto' ? town.content.gatheringPlace : place)}>
            Reunir a todos {place === 'auto' ? 'en la plaza' : 'allí'}
          </button>
          <button className={`god-btn ${curfew ? 'is-active' : ''}`} aria-pressed={curfew} onClick={() => town.setCurfew(!curfew)}>
            {curfew ? 'Levantar el toque de queda' : 'Toque de queda'}
          </button>
          <button className="god-btn" onClick={() => town.surprise()}>
            Pregón sorpresa
          </button>
        </div>
        <p className="field-hint">El pregón sorpresa usa un ejemplo al azar y deja al azar si es verdad.</p>
      </section>
    </aside>
  )
}
