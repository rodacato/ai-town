import { formatClock } from '../../../core/sim/clock'
import { useTown } from '../../store'
import { town } from '../../town'
import { activeLabel } from '../../../providers/llm/config'
import { Gear, Reset, Sun, TownMark, Users } from '../../shared/icons'

export function TopBar() {
  const minutes = useTown((s) => s.minutes)
  const outside = useTown((s) => s.outside)
  const total = town.content.residents.length
  const llm = useTown((s) => s.llm)
  const openSettings = () => useTown.getState().setSettingsOpen(true)
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
          <Sun className="pill-icon sun" />
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
        <button className="pill panel btn-pill" onClick={() => town.reset()} title="Devuelve a todos a su rutina y borra el anuncio">
          <Reset className="pill-icon" />
          Reiniciar
        </button>
      </div>
    </header>
  )
}
