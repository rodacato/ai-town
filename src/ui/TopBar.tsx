import { TOWN_NAME } from '../data/town'
import { formatClock } from '../sim/clock'
import { useTown } from '../store'
import { Reset, Sun, TownMark, Users } from './icons'

export function TopBar() {
  const minutes = useTown((s) => s.minutes)
  const outside = useTown((s) => s.outside)
  const total = useTown((s) => s.sim.residents.length)
  const resetTown = useTown((s) => s.resetTown)
  const { day, time } = formatClock(minutes)

  return (
    <header className="topbar">
      <div className="brand panel">
        <TownMark />
        <div className="brand-text">
          <span className="eyebrow">AI Town</span>
          <h1>{TOWN_NAME}</h1>
        </div>
      </div>
      <div className="topbar-stats">
        <div className="pill panel" title="Hora del pueblo">
          <Sun className="pill-icon sun" />
          <span className="pill-label">{day}</span>
          <span className="mono">{time}</span>
        </div>
        <div className="pill panel" title="Residentes en la calle ahora mismo">
          <Users className="pill-icon" />
          <span className="mono">{outside}</span>
          <span className="pill-label">de {total} en la calle</span>
        </div>
        <div className="pill panel mode" title="Las decisiones se simulan localmente, sin llamar a ningún modelo">
          <span className="dot" />
          <span className="pill-label">Modo simulado</span>
        </div>
        <button className="pill panel btn-pill" onClick={resetTown} title="Devuelve a todos a su rutina y borra el anuncio">
          <Reset className="pill-icon" />
          Reiniciar
        </button>
      </div>
    </header>
  )
}
