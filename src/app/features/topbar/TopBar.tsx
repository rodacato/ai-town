import { useState } from 'react'
import { formatClock } from '../../../core/sim/clock'
import { useTown } from '../../store'
import { town } from '../../town'
import { activeLabel } from '../../../providers/llm/config'
import { daylight } from '../../../theme/daylight'
import { Bolt, Gauge, Gear, Moon, Pause, Play, Sun, TownMark, Users } from '../../shared/icons'
import { useBench } from '../bench/benchStore'
import './topbar.css'

export function TopBar() {
  const minutes = useTown((s) => s.minutes)
  const outside = useTown((s) => s.outside)
  const total = town.content.residents.length
  const llm = useTown((s) => s.llm)
  const openSettings = () => useTown.getState().setSettingsOpen(true)
  const godOpen = useTown((s) => s.godOpen)
  const setGodOpen = useTown((s) => s.setGodOpen)
  const throneOpen = useTown((s) => s.throneOpen)
  const letters = useTown((s) => s.mailbox.filter((l) => !l.seen).length)
  const setThroneOpen = useTown((s) => s.setThroneOpen)
  const { day, time } = formatClock(minutes)

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand panel">
          <TownMark />
          <div className="brand-text">
            <span className="eyebrow">AI Town</span>
            <h1>{town.content.name}</h1>
          </div>
        </div>
        <div className="pill panel" title="Hora del pueblo">
          {daylight(minutes).night > 0.5 ? <Moon className="pill-icon moon" /> : <Sun className="pill-icon sun" />}
          <span className="pill-label">{day}</span>
          <span className="mono">{time}</span>
        </div>
        <div className="pill panel" title={`Residentes en la calle ahora mismo, de ${total}`}>
          <Users className="pill-icon" />
          <span className="mono">{outside}</span>
          <span className="pill-label people-label">de {total} en la calle</span>
        </div>
      </div>
      <TimeControls />
      <div className="topbar-right">
        <button className={`pill panel btn-pill mode ${llm.active === 'mock' ? '' : 'is-llm'}`} onClick={openSettings} title="Cambiar quién decide por los residentes">
          <span className="dot" />
          <span className="pill-label">{activeLabel(llm)}</span>
        </button>
        <button className={`pill panel btn-pill tool ${throneOpen ? 'is-active' : ''}`} onClick={() => setThroneOpen(!throneOpen)} aria-pressed={throneOpen} title="Gobierna como la Baronesa (T)" aria-label="Trono">
          <span className="pill-icon" aria-hidden>
            👑
          </span>
          <span className="pill-label">Trono</span>
          {letters > 0 && <span className="pill-badge mono" aria-label={`${letters} cartas nuevas`}>{letters}</span>}
        </button>
        <button className={`pill panel btn-pill tool ${godOpen ? 'is-active' : ''}`} onClick={() => setGodOpen(!godOpen)} aria-pressed={godOpen} title="Modo dios: tiempo, clima y eventos (G)" aria-label="Modo dios">
          <Bolt className="pill-icon" />
          <span className="pill-label">Dios</span>
        </button>
        <BenchButton />
        <button className="pill panel btn-pill icon-only" onClick={openSettings} aria-label="Configuración" title="Configuración: modelo de decisiones y partida">
          <Gear className="pill-icon gear" />
        </button>
      </div>
    </header>
  )
}

const SPEEDS = [1, 2, 4, 16]

/** Pause the town or run its days faster; the models keep their own pace. */
function TimeControls() {
  const speed = useTown((s) => s.speed)
  const autoplay = useTown((s) => s.autoplay)
  const [last, setLast] = useState(1)
  const toggle = () => {
    if (speed) setLast(speed)
    town.setSpeed(speed ? 0 : last)
  }
  return (
    <div className="time-controls panel" role="group" aria-label="Velocidad del pueblo">
      <button className="time-play" onClick={toggle} aria-label={speed ? 'Pausar' : 'Reanudar'} title={speed ? 'Pausar el pueblo' : 'Reanudar'}>
        {speed ? <Pause /> : <Play />}
      </button>
      {SPEEDS.map((v) => (
        <button key={v} className={`time-speed mono ${speed === v ? 'is-active' : ''}`} aria-pressed={speed === v} onClick={() => town.setSpeed(v)} title={v === 16 ? 'Un día en minuto y medio' : undefined}>
          ×{v}
        </button>
      ))}
      {autoplay && (
        <span className="time-auto" title="El terrario está en marcha">
          ▶ terrario
        </span>
      )}
    </div>
  )
}

function BenchButton() {
  const running = useBench((s) => s.running)
  const done = running ? Object.values(running.progress).reduce((n, p) => n + p.done, 0) : 0
  const total = running ? Object.values(running.progress).reduce((n, p) => n + p.total, 0) : 0
  return (
    <button className={`pill panel btn-pill bench ${running ? 'is-running' : 'icon-only'}`} onClick={() => useBench.getState().setOpen(true)} title="Compara modelos con los mismos pregones" aria-label="Banco de pruebas">
      <Gauge className="pill-icon gauge" />
      {running && <span className="pill-label mono">{Math.round((done / Math.max(1, total)) * 100)}%</span>}
    </button>
  )
}
