import { ACTION_META } from '../../../theme/actions'
import { RESIDENTS } from '../../../worlds/serena/residents'
import { useTown } from '../../store'
import { Avatar } from '../../shared/Avatar'
import { computeStats, seconds } from '../experiment/summary'

const PHASE_TIP = { unaware: 'sin enterarse', heard: 'escuchó', thinking: 'pensando…', error: 'error' }

export function Timeline() {
  const announcement = useTown((s) => s.announcement)
  const reactions = useTown((s) => s.reactions)
  const complete = useTown((s) => s.complete)
  const renderer = useTown((s) => s.renderer)
  const selectedId = useTown((s) => s.selectedId)
  const stats = computeStats(reactions)
  const total = announcement ? stats.listeners.length : RESIDENTS.length
  const thinking = stats.listeners.filter((r) => r.phase === 'thinking').length

  const subtitle = !announcement
    ? 'Transmite un anuncio para ver cómo decide cada residente.'
    : complete
      ? 'Todos han decidido. Haz clic en cualquiera para ver por qué.'
      : thinking
        ? `${thinking} ${thinking === 1 ? 'residente está pensando' : 'residentes están pensando'}…`
        : 'El anuncio se está propagando…'

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
        {RESIDENTS.map((r) => {
          const rx = reactions[r.id]
          const action = rx?.decision?.action
          const phase = rx?.isSpeaker ? 'speaker' : (rx?.phase ?? 'idle')
          const tip = rx?.isSpeaker ? 'hizo el anuncio' : action ? ACTION_META[action].short.toLowerCase() : rx ? PHASE_TIP[rx.phase as keyof typeof PHASE_TIP] : ''
          return (
            <li key={r.id}>
              <button
                className={`tl-person phase-${phase} ${selectedId === r.id ? 'is-selected' : ''}`}
                style={action ? { ['--c' as string]: ACTION_META[action].css } : undefined}
                onClick={() => renderer?.select(r.id)}
                onMouseEnter={() => renderer?.highlight(r.id)}
                onMouseLeave={() => renderer?.highlight(null)}
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
