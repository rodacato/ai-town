import { useEffect, useRef, useState } from 'react'
import type { OutcomeVisual } from '../../../core/reactions/outcome'
import { formatClock } from '../../../core/sim/clock'
import { SEASONS, SEASON_TEXT, type Season } from '../../../core/sim/season'
import { WEATHERS, WEATHER_TEXT, type Weather } from '../../../core/sim/weather'
import { useTown } from '../../store'
import { TrustMeter } from '../../shared/TrustMeter'
import { ago } from '../../../core/memory/memory'
import type { Speaker } from '../../../core/reactions/announcement'
import { Bolt, Close } from '../../shared/icons'
import { town } from '../../town'
import './god.css'

type Tab = 'world' | 'events' | 'town' | 'memory'
const TABS: [Tab, string][] = [
  ['world', 'Mundo'],
  ['events', 'Eventos'],
  ['town', 'Pueblo'],
  ['memory', 'Memoria'],
]
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
const SEASON_ICON: Record<Season, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' }
const WEATHER_ICON: Record<Weather, string> = { clear: '☀️', rain: '🌧️', storm: '⛈️', snow: '❄️', fog: '🌫️' }
/** What can be unleashed and where it happens unless the user picks a place. */
const EVENTS: { visual: OutcomeVisual; icon: string; label: string; place: string }[] = [
  { visual: 'fire', icon: '🐉', label: 'Dragón', place: 'forest' },
  { visual: 'monster', icon: '👹', label: 'Bestia', place: 'bridge' },
  { visual: 'undead', icon: '💀', label: 'Esqueletos', place: 'cemetery' },
  { visual: 'wolves', icon: '🐺', label: 'Lobos', place: 'forest' },
  { visual: 'ghost', icon: '👻', label: 'Fantasma', place: 'crypt' },
  { visual: 'blaze', icon: '🔥', label: 'Incendio', place: 'tavern' },
  { visual: 'flood', icon: '🌊', label: 'Crecida', place: 'riverbank' },
  { visual: 'meteor', icon: '☄️', label: 'Meteorito', place: 'field' },
  { visual: 'thief', icon: '🥷', label: 'Ladrón', place: 'market' },
  { visual: 'caravan', icon: '🐫', label: 'Caravana', place: 'gate' },
  { visual: 'feast', icon: '🍖', label: 'Festín', place: 'plaza' },
  { visual: 'treasure', icon: '💰', label: 'Tesoro', place: 'crypt' },
]

/** Which preset the clock is closest to, so the time control shows where the day is. */
function period(minutes: number) {
  const h = (minutes / 60) % 24
  return h >= 5 && h < 8 ? 0 : h >= 8 && h < 17 ? 1 : h >= 17 && h < 20 ? 2 : 3
}

export function GodPanel() {
  const open = useTown((s) => s.godOpen)
  if (!open) return null
  return <Drawer />
}

function Drawer() {
  const setGodOpen = useTown((s) => s.setGodOpen)
  const [tab, setTab] = useState<Tab>('world')
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ref.current?.contains(document.activeElement) && setGodOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setGodOpen])

  return (
    <aside className="god-panel panel" ref={ref} aria-label="Modo dios">
      <header className="god-head">
        <h2>
          <Bolt width={17} height={17} /> Modo dios
        </h2>
        <button className="icon-btn" onClick={() => setGodOpen(false)} aria-label="Cerrar modo dios">
          <Close />
        </button>
      </header>
      <div className="segmented" role="tablist" aria-label="Secciones" style={{ ['--cols' as string]: TABS.length, ['--active' as string]: TABS.findIndex(([k]) => k === tab) }}>
        <span className="segmented-thumb" aria-hidden />
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="god-body">
        {tab === 'world' && <World />}
        {tab === 'events' && <Events />}
        {tab === 'town' && <TownActions />}
        {tab === 'memory' && <TownMemoryView />}
      </div>
    </aside>
  )
}

function Choice<T>({ label, options, value, onPick, render }: { label: string; options: T[]; value: T; onPick: (v: T) => void; render: (v: T) => React.ReactNode }) {
  const active = options.indexOf(value)
  return (
    <div className="segmented" role="radiogroup" aria-label={label} style={{ ['--cols' as string]: options.length, ['--active' as string]: active }}>
      {active >= 0 && <span className="segmented-thumb" aria-hidden />}
      {options.map((o, i) => (
        <button key={i} role="radio" aria-checked={i === active} className={i === active ? 'is-active' : ''} onClick={() => onPick(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  )
}

function World() {
  const { minutes, speed, weather, season } = useTown()
  const { day, time } = formatClock(minutes)
  return (
    <>
      <div className="field">
        <span className="field-label god-row">
          Hora{' '}
          <span className="mono god-clock">
            {day} {time}
          </span>
        </span>
        <Choice label="Hora" options={HOURS} value={HOURS[period(minutes)]} onPick={([, h]) => town.setHour(h)} render={([l]) => l} />
      </div>
      <div className="field">
        <span className="field-label">Velocidad</span>
        <Choice label="Velocidad" options={SPEEDS.map(([, v]) => v)} value={speed} onPick={(v) => town.setSpeed(v)} render={(v) => SPEEDS.find(([, x]) => x === v)![0]} />
      </div>
      <div className="field">
        <span className="field-label">
          Estación <span className="god-note">{SEASON_TEXT[season].label}</span>
        </span>
        <Choice label="Estación" options={SEASONS} value={season} onPick={(s) => town.setSeason(s)} render={(s) => <span className="god-emoji" role="img" aria-label={SEASON_TEXT[s].label}>{SEASON_ICON[s]}</span>} />
      </div>
      <div className="field">
        <span className="field-label">
          Clima <span className="god-note">{WEATHER_TEXT[weather].label}</span>
        </span>
        <Choice label="Clima" options={WEATHERS} value={weather} onPick={(w) => town.setWeather(w)} render={(w) => <span className="god-emoji" role="img" aria-label={WEATHER_TEXT[w].label}>{WEATHER_ICON[w]}</span>} />
      </div>
      <p className="field-hint">La estación y el clima entran en lo que el modelo sabe; la velocidad no afecta a los modelos.</p>
    </>
  )
}

function Events() {
  const godEvent = useTown((s) => s.godEvent)
  const [place, setPlace] = useState('auto')
  const places = town.sim.world.places.filter((p) => p.keywords.length && p.spots.length)
  return (
    <>
      <label className="field">
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
      <div className="god-grid three">
        {EVENTS.map((e) => (
          <button key={e.visual} className="btn-secondary compact" onClick={() => town.unleash(e.visual, place === 'auto' ? e.place : place)}>
            <span aria-hidden>{e.icon}</span> {e.label}
          </button>
        ))}
      </div>
      <button className="btn-primary compact" onClick={() => town.unleashRandom()}>
        🎲 Algo inesperado
      </button>
      <p className="field-hint">Quien lo ve decide qué hacer y puede correr la voz. De noche, lo inesperado suele ser más tenebroso.</p>
      {godEvent && (
        <button className="btn-link" onClick={() => town.clearEvent()}>
          Quitar «{godEvent.summary.replace(/\.$/, '')}»
        </button>
      )}
    </>
  )
}

function TownActions() {
  const curfew = useTown((s) => s.curfew)
  return (
    <>
      <div className="god-stack">
        <button className="btn-secondary compact" onClick={() => town.gather(town.content.gatheringPlace)}>
          Reunir a todos en la plaza
        </button>
        <button className="btn-secondary compact" aria-pressed={curfew} onClick={() => town.setCurfew(!curfew)}>
          {curfew ? 'Levantar el toque de queda' : 'Toque de queda'}
        </button>
        <button className="btn-secondary compact" onClick={() => town.surprise()}>
          Pregón sorpresa
        </button>
      </div>
      <p className="field-hint">El pregón sorpresa usa un ejemplo al azar y deja al azar si es verdad.</p>
    </>
  )
}

/** Who the town trusts and what it remembers, with a way to forget it all. */
function TownMemoryView() {
  const entries = useTown((s) => s.memoryEntries)
  const [confirm, setConfirm] = useState(false)
  const speakers: Speaker[] = [{ kind: 'authority' }, { kind: 'stranger' }, ...town.content.residents.map((r) => ({ kind: 'neighbor' as const, residentId: r.id }))]
  const known = speakers.filter((s) => {
    const rep = town.memory.reputation(s)
    return s.kind !== 'neighbor' || rep.truths + rep.lies > 0
  })
  return (
    <section className="god-memory">
      <p className="field-hint">El pueblo recuerda quién dijo la verdad y quién mintió; eso cambia a quién le creen.</p>
      {known.map((s) => (
        <div key={s.kind === 'neighbor' ? s.residentId : s.kind} className="god-memory-row">
          <TrustMeter speaker={s} label={town.speakerShort(s)} />
        </div>
      ))}
      {entries.length > 0 && (
        <ul className="god-memory-log">
          {entries.slice(-4).reverse().map((e) => (
            <li key={e.id}>
              <span className="mono">{ago(useTown.getState().minutes, e.minutes)}</span> {e.summary}
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 &&
        (confirm ? (
          <button className="btn-link" onClick={() => (town.forgetMemory(), setConfirm(false))}>
            Sí, que el pueblo lo olvide todo
          </button>
        ) : (
          <button className="btn-link" onClick={() => setConfirm(true)}>
            Borrar la memoria del pueblo
          </button>
        ))}
    </section>
  )
}
