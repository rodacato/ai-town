import { formatClock } from '../../../core/sim/clock'
import { useTown } from '../../store'
import { town } from '../../town'
import { activeLabel } from '../../../providers/llm/config'
import { daylight } from '../../../theme/daylight'
import { Bolt, Gauge, Gear, Moon, Reset, Sun, TownMark, Users } from '../../shared/icons'
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
  const { day, time } = formatClock(minutes)

  return (
    <header className="topbar">
      <div className="brand panel">
        <TownMark />
        <div className="brand-text">
          <span className="eyebrow">AI Town</span>
          <h1>{town.content.name}</h1>
        </div>
      </div>
      <div className="topbar-stats">
        <div className="pill panel" title="Hora del pueblo">
          {daylight(minutes).night > 0.5 ? <Moon className="pill-icon moon" /> : <Sun className="pill-icon sun" />}
          <span className="pill-label">{day}</span>
          <span className="mono">{time}</span>
        </div>
        <div className="pill panel" title="Residentes en la calle ahora mismo">
          <Users className="pill-icon" />
          <span className="mono">{outside}</span>
          <span className="pill-label">de {total} en la calle</span>
        </div>
        <button className={`pill panel btn-pill mode ${llm.active === 'mock' ? '' : 'is-llm'}`} onClick={openSettings} title="Cambiar quién decide por los residentes">
          <span className="dot" />
          <span className="pill-label">{activeLabel(llm)}</span>
        </button>
        <button className="pill panel btn-pill icon-only" onClick={openSettings} aria-label="Configurar modelo de decisiones" title="Configurar modelo de decisiones">
          <Gear className="pill-icon gear" />
        </button>
        <button className={`pill panel btn-pill tool ${godOpen ? 'is-active' : ''}`} onClick={() => setGodOpen(!godOpen)} aria-pressed={godOpen} title="Modo dios: tiempo, clima y eventos (G)" aria-label="Modo dios">
          <Bolt className="pill-icon" />
          <span className="pill-label">Dios</span>
        </button>
        <BenchButton />
        <button className="pill panel btn-pill" onClick={() => town.reset()} title="Partida nueva: el pueblo vuelve a empezar, sin memoria ni historia">
          <Reset className="pill-icon reset" />
          Reiniciar
        </button>
      </div>
    </header>
  )
}

function BenchButton() {
  const running = useBench((s) => s.running)
  const done = running ? Object.values(running.progress).reduce((n, p) => n + p.done, 0) : 0
  const total = running ? Object.values(running.progress).reduce((n, p) => n + p.total, 0) : 0
  return (
    <button className={`pill panel btn-pill bench ${running ? 'is-running' : ''}`} onClick={() => useBench.getState().setOpen(true)} title="Compara modelos con los mismos pregones" aria-label="Banco de pruebas">
      <Gauge className="pill-icon gauge" />
      <span className="pill-label">{running ? <span className="mono">{Math.round((done / Math.max(1, total)) * 100)}%</span> : 'Pruebas'}</span>
    </button>
  )
}
