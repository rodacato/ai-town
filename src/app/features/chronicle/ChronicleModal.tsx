import type { ChronicleKind } from '../../../core/realm/chronicle'
import type { DayRecord } from '../../../core/realm/reign'
import { GOALS } from '../../../core/realm/standing'
import { chapters } from '../../../core/realm/terrarium'
import { formatClock } from '../../../core/sim/clock'
import type { Season } from '../../../core/sim/season'
import { useTown } from '../../store'
import { Close } from '../../shared/icons'
import { useDialog } from '../../shared/useDialog'
import { town } from '../../town'
import './chronicle.css'

const SEASON_ICON: Record<Season, string> = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' }
const KIND_ICON: Record<ChronicleKind, string> = { dawn: '🌅', decree: '📜', event: '⚡', reveal: '🔎', death: '🪦', leave: '🎒', ruler: '👑', petition: '✉️', plot: '🗡️', end: '🏁' }

export function ChronicleModal() {
  const open = useTown((s) => s.chronicleOpen)
  return open ? <Chronicle /> : null
}

const close = () => useTown.setState({ chronicleOpen: false })

interface Series {
  label: string
  read: (h: DayRecord) => number
  max: (rows: DayRecord[]) => number
  show: (v: number) => string
}

const SERIES: Series[] = [
  { label: 'Vecinos', read: (h) => h.population, max: () => town.content.residents.length, show: (v) => `${v}` },
  { label: 'Ánimo', read: (h) => h.mood, max: () => 1, show: (v) => `${Math.round(v * 100)}%` },
  { label: 'Confianza', read: (h) => h.trust, max: () => 1, show: (v) => `${Math.round(v * 100)}%` },
  { label: 'Tesoro', read: (h) => h.treasury, max: (rows) => Math.max(100, ...rows.map((h) => h.treasury)), show: (v) => `${v}` },
]

/** A tiny line over the reign's days, with today's value. */
function Spark({ s, rows }: { s: Series; rows: DayRecord[] }) {
  const W = 120
  const H = 34
  const max = s.max(rows) || 1
  const span = Math.max(1, GOALS.yearDays)
  const pts = rows.map((h) => `${((h.day / span) * W).toFixed(1)},${(H - (Math.max(0, s.read(h)) / max) * (H - 4) - 2).toFixed(1)}`).join(' ')
  const last = rows[rows.length - 1]
  return (
    <div className="spark">
      <span className="spark-label">{s.label}</span>
      <b className="mono">{last ? s.show(s.read(last)) : '—'}</b>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.label} a lo largo del reinado`}>
        <line x1="0" x2={W} y1={H - 2} y2={H - 2} className="spark-base" />
        {rows.length > 1 && <polyline points={pts} className="spark-line" />}
      </svg>
    </div>
  )
}

function Chronicle() {
  const { history, standing, seed } = useTown()
  useTown((s) => s.chronicle)
  const dialog = useDialog<HTMLDivElement>(close)
  const days = chapters(town.chronicle.entries)
  const seasonOf = (day: number) => history.find((h) => h.day === day)?.season
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal panel chronicle" role="dialog" aria-modal="true" aria-labelledby="chronicle-title" ref={dialog}>
        <header className="modal-header">
          <div>
            <h2 id="chronicle-title">Crónica de {town.content.name}</h2>
            <p>
              {standing.end ? `${standing.end.title} · ` : ''}Semilla {seed} · un año son {GOALS.yearDays} días
            </p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Cerrar">
            <Close />
          </button>
        </header>
        <div className="modal-body">
          <div className="sparks">
            {SERIES.map((s) => (
              <Spark key={s.label} s={s} rows={history} />
            ))}
          </div>
          {days.length ? (
            <ol className="chapters">
              {days.map((c) => {
                const season = seasonOf(c.day)
                return (
                  <li key={c.day}>
                    <details open={c === days[0]}>
                      <summary>
                        <span className="chapter-day mono">
                          Día {c.day + 1} {season ? SEASON_ICON[season] : ''}
                        </span>
                        <span className="chapter-head">{c.headline ? c.headline.text : 'Un día tranquilo.'}</span>
                      </summary>
                      <ul>
                        {c.entries.map((e, i) => (
                          <li key={i} className={`is-${e.kind}`}>
                            <span className="mono">{formatClock(e.minutes).time}</span>
                            <span aria-hidden>{KIND_ICON[e.kind]}</span>
                            <span>{e.text}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="field-hint">Todavía no ha pasado nada digno de contarse.</p>
          )}
        </div>
      </div>
    </div>
  )
}
