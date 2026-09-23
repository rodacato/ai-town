import type { LogEntry } from '../../../core/reactions/engine'
import { ACTION_META } from '../../../theme/actions'
import type { Action } from '../../../core/decisions/types'
import { useTown } from '../../store'
import { town } from '../../town'

const nameOf = (id: string) => town.content.residents.find((r) => r.id === id)?.name.split(' ')[0] ?? id

function describe(e: LogEntry) {
  switch (e.kind) {
    case 'queued':
      return `en cola para ${e.detail}`
    case 'sent':
      return `petición enviada a ${e.detail}`
    case 'streaming':
      return 'empezó a responder'
    case 'decided':
      return `decidió: ${ACTION_META[e.detail as Action]?.label.toLowerCase() ?? e.detail}`
    case 'error':
      return `error: ${e.detail}`
    case 'told':
      return `fue a avisar a ${nameOf(e.detail)}`
  }
}

/** A chronological trace of what was sent to the decision model and what came back. */
export function RequestLog() {
  const log = useTown((s) => s.log)
  const startedAt = useTown((s) => s.startedAt)
  return (
    <details className="request-log">
      <summary>
        Registro de peticiones <span className="mono">{log.length}</span>
      </summary>
      <ol>
        {[...log].reverse().map((e, i) => (
          <li key={log.length - i} className={`log-${e.kind}`}>
            <span className="mono log-time">+{((e.at - startedAt) / 1000).toFixed(1)} s</span>
            <button className="inline-link" onClick={() => town.select(e.id)}>
              {nameOf(e.id)}
            </button>
            <span>{describe(e)}</span>
          </li>
        ))}
        {!log.length && <li className="log-empty">{`Aparecerá aquí en cuanto alguien escuche el ${town.content.copy.noun}.`}</li>}
      </ol>
    </details>
  )
}
