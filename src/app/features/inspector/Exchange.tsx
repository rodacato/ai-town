import type { Reaction } from '../../../core/reactions/engine'
import { seconds, tokens, usd } from '../experiment/summary'

/** The raw request and response behind a decision, with where the time went. */
export function Exchange({ reaction, now = performance.now() }: { reaction: Reaction; now?: number }) {
  const { queuedAt, startedAt, firstTokenAt, decidedAt, request, response, usage, calls } = reaction
  if (!request && queuedAt === null) return null
  const end = decidedAt ?? now
  const rows: [string, string][] = []
  if (queuedAt !== null) rows.push(['En cola', seconds((startedAt ?? end) - queuedAt)])
  if (startedAt !== null) rows.push(['Hasta la primera palabra', firstTokenAt !== null ? seconds(firstTokenAt - startedAt) : '…'])
  if (startedAt !== null && decidedAt !== null) rows.push(['Respuesta completa', seconds(decidedAt - startedAt)])
  if (usage?.inputTokens !== undefined) rows.push(['Tokens (entrada → salida)', `${tokens(usage.inputTokens)} → ${tokens(usage.outputTokens ?? 0)}`])
  if (usage?.costUsd !== undefined) rows.push([usage.costSource === 'table' ? 'Costo estimado' : 'Costo reportado', usd(usage.costUsd)])
  if (calls.length > 1) rows.push(['Peticiones de este residente', String(calls.length)])
  return (
    <details className="exchange">
      <summary>Ver petición y respuesta</summary>
      <dl className="exchange-times">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
      {request && (
        <>
          <h4>Instrucciones del sistema</h4>
          <pre>{request.system}</pre>
          <h4>Lo que se envió</h4>
          <pre>{request.prompt}</pre>
        </>
      )}
      <h4>Lo que respondió</h4>
      <pre>{response ?? 'Todavía no hay respuesta.'}</pre>
    </details>
  )
}
