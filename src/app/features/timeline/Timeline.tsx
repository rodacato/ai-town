import { ACTION_META } from '../../../theme/actions'
import { useTown } from '../../store'
import { Avatar } from '../../shared/Avatar'
import type { Reaction } from '../../../core/reactions/engine'
import { thinkingStage } from '../experiment/stages'
import { computeStats, seconds } from '../experiment/summary'
import { town } from '../../town'
import './timeline.css'

const PHASE_TIP = { unaware: 'sin enterarse', heard: 'escuchó', thinking: 'pensando…', error: 'error' }

function stageSummary(listeners: Reaction[]) {
  const counts = { queued: 0, sending: 0, streaming: 0 }
  for (const r of listeners) if (r.phase === 'thinking') counts[thinkingStage(r)]++
  const parts = [
    counts.queued && `${counts.queued} en cola`,
    counts.sending && `${counts.sending} esperando al modelo`,
    counts.streaming && `${counts.streaming} escribiendo`,
  ].filter(Boolean)
  return `${parts.join(' · ')}…`
}

export function Timeline() {
  const announcement = useTown((s) => s.announcement)
  const reactions = useTown((s) => s.reactions)
  const complete = useTown((s) => s.complete)
  const selectedId = useTown((s) => s.selectedId)
  const stats = computeStats(reactions)
  const total = announcement ? stats.listeners.length : town.content.residents.length
  const thinking = stats.listeners.filter((r) => r.phase === 'thinking').length

  const subtitle = !announcement
    ? town.content.copy.emptyHint
    : complete
      ? 'Todos han decidido. Haz clic en cualquiera para ver por qué.'
      : thinking
        ? stageSummary(stats.listeners)
        : `El ${town.content.copy.noun} se está propagando…`

  return (
    <section className="timeline panel" aria-label="Reacciones de los residentes">
      <div className="tl-title">
        <h2>Reacciones</h2>
        <p>{subtitle}</p>
      </div>
      <dl className="tl-stats">
        <div>
          <dt>Decidieron</dt>
          <dd className="mono">
            {stats.decided.length}
            <span>/{total}</span>
          </dd>
        </div>
        <div>
          <dt>Mediana</dt>
          <dd className={`mono ${stats.median === null ? 'is-empty' : ''}`}>{stats.median === null ? '—' : seconds(stats.median)}</dd>
        </div>
        <div>
          <dt>Más lento</dt>
          <dd className={`mono ${stats.slowest ? '' : 'is-empty'}`}>{stats.slowest ? seconds(stats.slowest.latencyMs ?? 0) : '—'}</dd>
        </div>
      </dl>
      <ul className="tl-people">
        {town.content.residents.map((r) => {
          const rx = reactions[r.id]
          const action = rx?.decision?.action
          const phase = rx?.isSpeaker ? 'speaker' : (rx?.phase ?? 'idle')
          const tip = rx?.isSpeaker ? `hizo el ${town.content.copy.noun}` : action ? ACTION_META[action].short.toLowerCase() : rx ? PHASE_TIP[rx.phase as keyof typeof PHASE_TIP] : ''
          return (
            <li key={r.id}>
              <button
                className={`tl-person phase-${phase} ${selectedId === r.id ? 'is-selected' : ''}`}
                style={action ? { ['--c' as string]: ACTION_META[action].css } : undefined}
                onClick={() => town.select(r.id)}
                onMouseEnter={() => town.highlight(r.id)}
                onMouseLeave={() => town.highlight(null)}
                aria-label={`${r.name}${tip ? `: ${tip}` : ''}`}
                data-name={`${r.name.split(' ')[0]}${tip ? ` · ${tip}` : ''}`}
              >
                <Avatar look={r.look} size={30} />
                {rx?.decision && <span className="tl-emoji">{rx.decision.emoji}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
