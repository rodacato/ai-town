import { useEffect, useState } from 'react'
import { formatClock } from '../../../core/sim/clock'
import { dayOf } from '../../../core/economy/economy'
import { useTown } from '../../store'
import type { Activity, ActivityKind } from '../../store/reign'
import { Close } from '../../shared/icons'
import { useDialog } from '../../shared/useDialog'
import { town } from '../../town'
import './activity.css'

export function ActivityModal() {
  const open = useTown((s) => s.activityOpen)
  return open ? <ActivityLog /> : null
}

const close = () => useTown.setState({ activityOpen: false })

type Filter = 'all' | 'calls' | 'realm' | 'town'
const FILTERS: [Filter, string, ActivityKind[]][] = [
  ['all', 'Todo', ['ruler', 'residents', 'musing', 'realm', 'town']],
  ['calls', 'Decisiones', ['ruler', 'residents', 'musing']],
  ['realm', 'Reino', ['realm', 'ruler']],
  ['town', 'Pueblo', ['town', 'residents', 'musing']],
]
const ICON: Record<ActivityKind, string> = { ruler: '👑', residents: '📣', musing: '💭', realm: '📜', town: '🏘️' }

const since = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000))
  return s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`
}

/** Is anybody thinking with a model, and is it answering? */
function Status({ now }: { now: number }) {
  const { activity, rulerMode, rulerCalls, rulerCap, rulerCost, llm } = useTown()
  const residentsVia = town.residentsVia()
  const calls = activity.filter((a) => a.via && a.via !== 'reglas')
  const pending = calls.filter((a) => a.status === 'pending').length
  const lastOk = [...calls].reverse().find((a) => a.status === 'ok')
  const recent = calls.slice(-10)
  const errors = recent.filter((a) => a.status === 'error').length
  const spent = calls.reduce((n, a) => n + (a.costUsd ?? 0), 0)
  const ruler = rulerMode === 'manual' ? 'tú (desde el Trono)' : rulerMode === 'rules' || llm.active === 'mock' ? 'reglas, sin gastar' : `${llm.connections[llm.active].model} · ${rulerCalls}/${rulerCap} consultas`
  return (
    <dl className="activity-status">
      <div>
        <dt>Los vecinos deciden con</dt>
        <dd>{residentsVia === 'reglas' ? 'reglas, sin gastar' : residentsVia}</dd>
      </div>
      <div>
        <dt>Gobierna</dt>
        <dd>
          {ruler}
          {rulerCost ? ` · $${rulerCost.toFixed(3)}` : ''}
        </dd>
      </div>
      <div>
        <dt>El modelo</dt>
        <dd className={errors >= 3 ? 'is-bad' : ''}>
          {pending ? <span className="activity-live">pensando ({pending})</span> : lastOk ? `respondió ${since(lastOk.at, now)}` : calls.length ? 'sin respuestas todavía' : 'no se ha usado'}
          {errors ? ` · ${errors} error${errors > 1 ? 'es' : ''} en las últimas ${recent.length}` : ''}
          {spent ? ` · $${spent.toFixed(3)} en total` : ''}
        </dd>
      </div>
    </dl>
  )
}

function Row({ a, now }: { a: Activity; now: number }) {
  const { time } = formatClock(a.minutes)
  return (
    <li className={`activity-row is-${a.status}`}>
      <span className="activity-when mono" title={since(a.at, now)}>
        D{dayOf(a.minutes) + 1} {time}
      </span>
      <span aria-hidden className="activity-icon">
        {a.status === 'pending' ? '⏳' : a.status === 'error' ? '⚠️' : ICON[a.kind]}
      </span>
      <div className="activity-body">
        <p className="activity-title">{a.title}</p>
        {a.detail && <p className="activity-detail">{a.detail}</p>}
        {(a.via || a.ms || a.costUsd) && (
          <p className="activity-meta mono">
            {[a.via, a.ms ? `${(a.ms / 1000).toFixed(1)} s` : null, a.costUsd ? `$${a.costUsd.toFixed(4)}` : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </li>
  )
}

/** Everything that touched the terrarium, newest first: model calls with their time and cost, dawns, decrees, events. */
function ActivityLog() {
  const activity = useTown((s) => s.activity)
  const dialog = useDialog<HTMLDivElement>(close)
  const [filter, setFilter] = useState<Filter>('all')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const kinds = FILTERS.find(([k]) => k === filter)![2]
  const rows = activity.filter((a) => kinds.includes(a.kind)).reverse()
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal panel activity" role="dialog" aria-modal="true" aria-labelledby="activity-title" ref={dialog}>
        <header className="modal-header">
          <div>
            <h2 id="activity-title">Bitácora</h2>
            <p>Lo que va pasando en el terrario y cada decisión: quién la tomó, cuánto tardó y cuánto costó.</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Cerrar">
            <Close />
          </button>
        </header>
        <div className="modal-body">
          <Status now={now} />
          <div className="segmented" role="tablist" aria-label="Filtrar" style={{ ['--cols' as string]: FILTERS.length, ['--active' as string]: FILTERS.findIndex(([k]) => k === filter) }}>
            <span className="segmented-thumb" aria-hidden />
            {FILTERS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'is-active' : ''} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
          {rows.length ? (
            <ol className="activity-list">
              {rows.map((a) => (
                <Row key={a.id} a={a} now={now} />
              ))}
            </ol>
          ) : (
            <p className="field-hint">Nada todavía. Deja correr el tiempo, haz un pregón o consulta a la Baronesa.</p>
          )}
        </div>
      </div>
    </div>
  )
}
