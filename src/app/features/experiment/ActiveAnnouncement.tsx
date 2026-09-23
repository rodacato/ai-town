import type { Reaction } from '../../../core/reactions/engine'
import { ACTIONS } from '../../../core/decisions/types'
import { ACTION_META } from '../../../theme/actions'
import { speakerName, type Announcement } from '../../../core/reactions/announcement'
import { formatClock } from '../../../core/sim/clock'
import { useTown } from '../../store'
import { ActionPill } from '../../shared/ActionPill'
import { Avatar } from '../../shared/Avatar'
import { Alert, Download, Reset, Sparkle } from '../../shared/icons'
import { PlaceChip } from '../../shared/PlaceChip'
import { SpeakerBadge } from '../../shared/SpeakerBadge'
import { RequestLog } from './RequestLog'
import { STAGE_LABEL, queuePosition, thinkingStage } from './stages'
import { computeStats, seconds, summarize, tokens, usd } from './summary'
import { allCalls, runMetrics } from '../../../core/reactions/metrics'
import { callsCsv, download, runReport, stamp } from './export'
import { town } from '../../town'
import './experiment.css'

export function ActiveAnnouncement({ announcement }: { announcement: Announcement }) {
  const reactions = useTown((s) => s.reactions)
  const complete = useTown((s) => s.complete)
  const { day, time } = formatClock(announcement.minutes)
  const stats = computeStats(reactions)
  const total = stats.listeners.length

  return (
    <div className="panel-view active-announcement">
      <div className={`on-air ${complete ? 'is-complete' : ''}`}>
        <span className="on-air-dot" />
        {complete ? 'Experimento completo' : town.content.copy.onAir}
        <span className="on-air-time mono">
          {day} · {time}
        </span>
      </div>

      <figure className="quote">
        <blockquote>“{announcement.text}”</blockquote>
        <figcaption>
          <SpeakerBadge speaker={announcement.speaker} size={32} />
          <span>{speakerName(town.content, announcement.speaker)}</span>
        </figcaption>
      </figure>
      <PlaceChip place={announcement.place} />

      <FailureBanner reactions={stats.listeners} />
      {complete && <Summary announcement={announcement} reactions={reactions} />}

      <div className="progress-card">
        <div className="progress-head">
          <span className="section-label">Reacciones</span>
          <span className="mono progress-count">
            {stats.decided.length} / {total}
          </span>
        </div>
        <div className="progress-track segmented-bar" role="progressbar" aria-valuenow={stats.decided.length} aria-valuemax={total}>
          {ACTIONS.map((a) =>
            stats.counts[a] ? <span key={a} className="bar-seg" style={{ width: `${(stats.counts[a] / Math.max(1, total)) * 100}%`, background: ACTION_META[a].css }} /> : null,
          )}
          {stats.decided.length < total && <span className="bar-rest shimmer" />}
        </div>
        <ul className="legend">
          {ACTIONS.map((a) => (
            <li key={a} className={stats.counts[a] ? '' : 'is-zero'}>
              <span className="action-dot" style={{ background: ACTION_META[a].css }} />
              {ACTION_META[a].short}
              <b className="mono">{stats.counts[a]}</b>
            </li>
          ))}
        </ul>
        <dl className="mini-stats">
          <div>
            <dt>Le creyeron</dt>
            <dd className="mono">{stats.decided.length ? `${stats.believers}/${stats.decided.length}` : '—'}</dd>
          </div>
          <div>
            <dt>Mediana</dt>
            <dd className="mono">{stats.median !== null ? seconds(stats.median) : '—'}</dd>
          </div>
          <div>
            <dt>Más lento</dt>
            <dd className="mono">{stats.slowest ? seconds(stats.slowest.latencyMs ?? 0) : '—'}</dd>
          </div>
        </dl>
        <LatencyChart reactions={stats.decided} />
      </div>

      <Usage reactions={stats.listeners} />

      <Feed reactions={stats.listeners} />
      <RequestLog />
      {complete && <ExportRun announcement={announcement} reactions={reactions} />}

      <button className="btn-secondary" onClick={() => town.reset()}>
        <Reset width={15} height={15} />
        Reiniciar y probar otro {town.content.copy.noun}
      </button>
    </div>
  )
}

/** Tokens, cost and latency percentiles across every call, the numbers a benchmark compares. */
function Usage({ reactions }: { reactions: Reaction[] }) {
  const calls = allCalls(reactions)
  // The simulated mode has no tokens or real latency worth comparing.
  if (!calls.some((c) => c.usage)) return null
  const m = runMetrics(calls)
  const rows: [string, string, string?][] = [
    ['Peticiones', m.errors ? `${m.calls} (${m.errors} con error)` : String(m.calls)],
    ['Tokens', `${tokens(m.inputTokens)} → ${tokens(m.outputTokens)}`, 'Entrada → salida'],
    ['Costo', m.costUsd === null ? '—' : `${m.costEstimated ? '≈ ' : ''}${usd(m.costUsd)}`, m.costUsd === null ? 'Ni el host ni la tabla de precios dan un costo; ponlo en Configuración.' : m.costEstimated ? 'Estimado con la tabla de precios.' : 'Reportado por el host.'],
    ['Primera palabra', m.ttft ? `${seconds(m.ttft.p50)} · p95 ${seconds(m.ttft.p95)}` : '—', 'Mediana y percentil 95'],
    ['Respuesta', m.total ? `${seconds(m.total.p50)} · p95 ${seconds(m.total.p95)}` : '—', 'Mediana y percentil 95'],
    ['En cola', m.queue ? `${seconds(m.queue.p50)} · máx ${seconds(m.queue.max)}` : '—'],
    ['Velocidad', m.tokensPerSecond ? `${m.tokensPerSecond.toFixed(0)} tokens/s` : '—', 'Tokens de salida por segundo, sin contar la espera'],
  ]
  return (
    <section className="usage-card">
      <h3 className="section-label">Consumo</h3>
      <dl>
        {rows.map(([k, v, hint]) => (
          <div key={k} title={hint}>
            <dt>{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ExportRun({ announcement, reactions }: { announcement: Announcement; reactions: Record<string, Reaction> }) {
  const name = `${town.content.id}-${stamp()}`
  return (
    <div className="export-row">
      <span className="section-label">Exportar</span>
      <button className="btn-secondary compact" onClick={() => download(`${name}.json`, JSON.stringify(runReport(announcement, reactions, useTown.getState().llm), null, 2), 'application/json')}>
        <Download width={14} height={14} /> JSON
      </button>
      <button className="btn-secondary compact" onClick={() => download(`${name}.csv`, callsCsv(reactions), 'text/csv')}>
        <Download width={14} height={14} /> CSV
      </button>
    </div>
  )
}

function FailureBanner({ reactions }: { reactions: Reaction[] }) {
  const { llm, setSettingsOpen } = useTown.getState()
  const failed = reactions.filter((r) => r.phase === 'error')
  if (failed.length < 2) return null
  const useMock = () => {
    town.applySettings({ ...llm, active: 'mock' })
    town.retry(failed.map((r) => r.id))
  }
  return (
    <div className="failure-banner" role="alert">
      <Alert width={16} height={16} />
      <div>
        <p>
          <b>{failed.length} residentes no pudieron decidir.</b> {failed[0].error}
        </p>
        <div className="failure-actions">
          <button className="btn-link" onClick={() => town.retry(failed.map((r) => r.id))}>
            Reintentar
          </button>
          <button className="btn-link" onClick={useMock}>
            Usar modo simulado
          </button>
          <button className="btn-link" onClick={() => setSettingsOpen(true)}>
            Revisar configuración
          </button>
        </div>
      </div>
    </div>
  )
}

function Summary({ announcement, reactions }: { announcement: Announcement; reactions: Record<string, Reaction> }) {
  const s = summarize(reactions, announcement)
  return (
    <section className="summary-card">
      <span className="summary-eyebrow">
        <Sparkle width={13} height={13} /> Resumen del experimento
      </span>
      <h3>{s.headline}.</h3>
      <ul>
        {s.insights.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  )
}

function LatencyChart({ reactions }: { reactions: Reaction[] }) {
  const ordered = [...reactions].sort((a, b) => (a.decidedAt ?? 0) - (b.decidedAt ?? 0))
  const max = Math.max(1000, ...ordered.map((r) => r.latencyMs ?? 0))
  return (
    <div className="latency">
      <div className="latency-head">
        <span>Tiempo de decisión, en orden de llegada</span>
        <span className="mono">{seconds(max)}</span>
      </div>
      <div className="latency-bars">
        {ordered.map((r) => (
          <button
            key={r.id}
            className="latency-bar"
            style={{ height: `${Math.max(6, ((r.latencyMs ?? 0) / max) * 100)}%`, background: ACTION_META[r.decision!.action].css }}
            title={`${town.content.residents.find((p) => p.id === r.id)?.name}: ${seconds(r.latencyMs ?? 0)}`}
            onClick={() => town.select(r.id)}
            onMouseEnter={() => town.highlight(r.id)}
            onMouseLeave={() => town.highlight(null)}
          />
        ))}
        {!ordered.length && <span className="latency-empty">Las barras aparecen a medida que deciden.</span>}
      </div>
    </div>
  )
}

const PHASE_ORDER = { thinking: 0, heard: 1, error: 2, decided: 3, unaware: 4 }

function Feed({ reactions }: { reactions: Reaction[] }) {
  const rows = [...reactions].sort((a, b) =>
    a.phase === 'decided' && b.phase === 'decided' ? (b.decidedAt ?? 0) - (a.decidedAt ?? 0) : PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase],
  )
  const reasoning = useTown((s) => s.reasoning)
  return (
    <section className="feed">
      <h3 className="section-label">Residentes</h3>
      <ul>
        {rows.map((r) => {
          const p = town.content.residents.find((x) => x.id === r.id)!
          return (
            <li key={r.id}>
              <button className={`feed-row phase-${r.phase}`} onClick={() => town.select(r.id)} onMouseEnter={() => town.highlight(r.id)} onMouseLeave={() => town.highlight(null)}>
                <Avatar look={p.look} size={30} />
                <span className="feed-text">
                  <span className="feed-name">{p.name}</span>
                  <span className="feed-sub">{feedSub(r, reasoning[r.id], reactions)}</span>
                </span>
                <span className="feed-end">
                  {r.decision ? <ActionPill action={r.decision.action} short /> : <span className="feed-state">{r.phase === 'thinking' ? STAGE_LABEL[thinkingStage(r)] : PHASE_LABEL[r.phase]}</span>}
                  {r.latencyMs !== null && <span className="mono feed-latency">{seconds(r.latencyMs)}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const PHASE_LABEL = { unaware: 'Sin enterarse', heard: 'Escuchó', thinking: 'Pensando…', decided: '', error: 'Error' }

function feedSub(r: Reaction, streamed: string | undefined, all: Reaction[]) {
  if (r.phase === 'decided' && r.decision) return `${r.decision.emoji} «${r.decision.speech}»`
  if (r.phase === 'thinking') {
    const stage = thinkingStage(r)
    if (stage === 'queued') {
      const ahead = queuePosition(r, all)
      return ahead ? `Esperando turno: ${ahead} por delante.` : 'Es la siguiente en pasar.'
    }
    if (stage === 'sending') return 'Petición enviada, esperando respuesta…'
    return streamed ? `…${streamed.slice(-60).replace(/^\S*\s/, '')}` : 'Escribiendo…'
  }
  if (r.phase === 'error') return r.error ?? 'No pudo decidir.'
  if (r.phase === 'heard') return `Acaba de escuchar el ${town.content.copy.noun}.`
  return `Todavía no le llega el ${town.content.copy.noun}.`
}
