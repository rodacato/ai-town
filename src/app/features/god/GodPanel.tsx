import { useEffect, useRef, useState } from 'react'
import type { OutcomeVisual } from '../../../core/reactions/outcome'
import { formatClock, hourOf } from '../../../core/sim/clock'
import { SEASONS, SEASON_TEXT, type Season } from '../../../core/sim/season'
import { WEATHERS, WEATHER_TEXT, type Weather } from '../../../core/sim/weather'
import { useTown } from '../../store'
import { TrustMeter } from '../../shared/TrustMeter'
import { ago } from '../../../core/memory/memory'
import type { Speaker } from '../../../core/reactions/announcement'
import { Bolt, Close } from '../../shared/icons'
import { Choice } from '../../shared/Choice'
import { town } from '../../town'
import { NewGame } from '../../shared/NewGame'
import { GOALS } from '../../../core/realm/standing'
import { describeEffect } from '../../../core/economy/impact'
import './god.css'

type Tab = 'terrarium' | 'world' | 'events' | 'town' | 'memory'
const TABS: [Tab, string][] = [
  ['terrarium', 'Terrario'],
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
  ['×16', 16],
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
  const h = hourOf(minutes)
  return h >= 5 && h < 8 ? 0 : h >= 8 && h < 17 ? 1 : h >= 17 && h < 20 ? 2 : 3
}

export function GodPanel() {
  const open = useTown((s) => s.godOpen)
  if (!open) return null
  return <Drawer />
}

function Drawer() {
  const setGodOpen = useTown((s) => s.setGodOpen)
  const [tab, setTab] = useState<Tab>('terrarium')
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
        {tab === 'terrarium' && <Terrarium />}
        {tab === 'world' && <World />}
        {tab === 'events' && <Events />}
        {tab === 'town' && <TownActions />}
        {tab === 'memory' && <TownMemoryView />}
      </div>
    </aside>
  )
}

const foretell = (visual: OutcomeVisual, place: string) => {
  const e = EVENTS.find((x) => x.visual === visual)
  const where = town.sim.world.places.find((p) => p.id === place)?.name
  return `${e?.icon ?? '❔'} ${e?.label ?? visual}${where ? ` · ${where}` : ''}`
}

/** The town running on its own: start or stop it, see what fate has in store, keep the game in a file. */
function Terrarium() {
  const { autoplay, seed, fateDone, residentsOnModel, realm, season, standing, llm } = useTown()
  const file = useRef<HTMLInputElement>(null)
  const day = realm?.day ?? 0
  const coming = town.terrarium.calendar().filter((f) => f.day > fateDone && f.day >= day).slice(0, 3)
  const save = () => {
    const { name, text } = town.exportGame()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <>
      <button className={autoplay ? 'btn-secondary' : 'btn-primary'} onClick={() => town.setAutoplay(!autoplay)} disabled={!!standing.end && !autoplay}>
        {autoplay ? '⏸ Detener el terrario' : '▶ Poner en marcha el terrario'}
      </button>
      <p className="field-hint">
        {standing.end
          ? `Partida terminada: ${standing.end.title}. Reinicia para empezar otra.`
          : `Día ${day + 1} de ${GOALS.yearDays} · ${SEASON_ICON[season]} ${SEASON_TEXT[season].label} · semilla ${seed}. Las estaciones cambian cada 10 días y el destino golpea en su día.`}
      </p>
      <label className="check">
        <input type="checkbox" checked={residentsOnModel} disabled={llm.active === 'mock'} onChange={(e) => town.setResidentsOnModel(e.target.checked)} />
        <span>Los vecinos también piensan con el modelo (gasta muchas más consultas)</span>
      </label>
      <div className="field">
        <span className="field-label">Próximos golpes del destino</span>
        <ul className="god-fate">
          {coming.length ? (
            coming.map((f) => (
              <li key={f.day}>
                <span className="mono">
                  Día {f.day + 1} · {String(f.hour).padStart(2, '0')}:00
                </span>{' '}
                {foretell(f.visual, f.place)}
              </li>
            ))
          ) : (
            <li className="muted">Nada más en el calendario.</li>
          )}
        </ul>
      </div>
      <div className="god-grid three">
        <button className="btn-secondary compact" onClick={() => useTown.setState({ chronicleOpen: true })}>
          📜 Crónica
        </button>
        <button className="btn-secondary compact" onClick={save}>
          💾 Guardar
        </button>
        <button className="btn-secondary compact" onClick={() => file.current?.click()}>
          📂 Cargar
        </button>
      </div>
      <NewGame />
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void f.text().then((t) => town.importGame(t))
          e.target.value = ''
        }}
      />
    </>
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
  const running = useTown((s) => s.events)
  const minutes = useTown((s) => s.minutes)
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
          <button key={e.visual} className="btn-secondary compact" onClick={() => town.unleash(e.visual, place === 'auto' ? e.place : place)} title={describeEffect(e.visual)}>
            <span aria-hidden>{e.icon}</span> {e.label}
          </button>
        ))}
      </div>
      <button className="btn-primary compact" onClick={() => town.unleashRandom()}>
        🎲 Algo inesperado
      </button>
      <p className="field-hint">Quien lo ve decide qué hacer y puede correr la voz. Cada evento dura un rato al azar y su costo o beneficio llega al terminar: cuanto más dura, más pesa. Pasa el ratón por un botón para ver qué cuesta.</p>
      {running.length > 0 && (
        <div className="field">
          <span className="field-label">En curso</span>
          <ul className="god-fate">
            {running.map((x) => (
              <li key={x.activity}>
                {x.summary.replace(/\.$/, '')} <span className="mono">· termina en {Math.max(0, Math.ceil((x.until - minutes) / 60))} h</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {godEvent && (
        <button className="btn-link" onClick={() => town.clearEvent()}>
          Quitar «{godEvent.summary.replace(/\.$/, '')}»
        </button>
      )}
    </>
  )
}

function TownActions() {
  return (
    <>
      <div className="god-stack">
        <button className="btn-secondary compact" onClick={() => town.gather(town.content.gatheringPlace)}>
          Reunir a todos en la plaza
        </button>
        <button className="btn-secondary compact" onClick={() => town.surprise()}>
          Pregón sorpresa
        </button>
        <button className="btn-secondary compact" onClick={() => town.throne.stirGuild()}>
          🗡️ Azuzar al gremio de ladrones
        </button>
      </div>
      <p className="field-hint">El pregón sorpresa usa un ejemplo al azar y deja al azar si es verdad. El gremio azuzado asalta el castillo al próximo amanecer; la leva de guardias reduce el botín.</p>
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
