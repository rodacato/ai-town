import type { Reaction } from '../../../core/reactions/engine'
import { RESIDENTS } from '../../../worlds/serena/residents'
import { useTown } from '../../store'
import { ActionPill } from '../../shared/ActionPill'
import { firstName, seconds } from '../experiment/summary'
import { useNow } from '../../shared/useNow'

export function ReactionDetail({ reaction, name }: { reaction: Reaction | undefined; name: string }) {
  const engine = useTown((s) => s.engine)
  const renderer = useTown((s) => s.renderer)
  const now = useNow(reaction?.phase === 'thinking')
  const first = name.split(' ')[0]

  if (!reaction) return <div className="reaction-body is-empty">Todavía no hay anuncio. Cuando transmitas uno, aquí verás qué decide {first} y por qué.</div>
  if (reaction.isSpeaker) return <div className="reaction-body is-empty">{first} hizo el anuncio.</div>

  switch (reaction.phase) {
    case 'unaware':
      return <div className="reaction-body is-empty">Todavía no le ha llegado el anuncio.</div>
    case 'heard':
      return <div className="reaction-body is-waiting">Acaba de escucharlo…</div>
    case 'thinking':
      return (
        <div className="reaction-body is-thinking">
          <div className="thinking-head">
            <span className="thinking-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {reaction.startedAt ? 'Pensando' : 'En cola'}
            {reaction.startedAt && <span className="mono">{seconds(now - reaction.startedAt)}</span>}
          </div>
          {reaction.reasoning && (
            <p className="reasoning is-streaming">
              {reaction.reasoning}
              <span className="caret" />
            </p>
          )}
        </div>
      )
    case 'error':
      return (
        <div className="reaction-body is-error">
          <p>No pudo decidir: {reaction.error}</p>
          <button className="btn-link" onClick={() => engine.retry(reaction.id)}>
            Reintentar
          </button>
        </div>
      )
    case 'decided': {
      const d = reaction.decision!
      const via = reaction.heardVia && reaction.heardVia !== 'broadcast' ? `de boca de ${firstName(reaction.heardVia)}` : 'por el anuncio'
      return (
        <div className="reaction-body is-decided">
          <div className="decision-top">
            <ActionPill action={d.action} />
            <span className={`belief ${d.believes ? 'yes' : 'no'}`}>{d.believes ? 'Le cree' : 'No se lo cree'}</span>
            <span className="mono decision-latency">{seconds(reaction.latencyMs ?? 0)}</span>
          </div>
          <blockquote className="speech">
            <span className="speech-emoji">{d.emoji}</span>«{d.speech}»
          </blockquote>
          <p className="reasoning">{d.reasoning}</p>
          <div className="confidence">
            <span>Seguridad</span>
            <span className="confidence-track">
              <span style={{ width: `${Math.round(d.confidence * 100)}%` }} />
            </span>
            <span className="mono">{Math.round(d.confidence * 100)}%</span>
          </div>
          <ul className="decision-meta">
            <li>Se enteró {via}.</li>
            {reaction.decidedBy && <li>Decidido por {reaction.decidedBy}.</li>}
            {d.tell.length > 0 && (
              <li>
                Decidió avisar a{' '}
                {d.tell.map((id, i) => (
                  <span key={id}>
                    {i > 0 && (i === d.tell.length - 1 ? ' y ' : ', ')}
                    <button className="inline-link" onClick={() => renderer?.select(id)}>
                      {firstName(id)}
                    </button>
                  </span>
                ))}
                {reaction.told.length < d.tell.length ? ' (en camino)' : ''}.
              </li>
            )}
            {reaction.revisedBy && reaction.previous && (
              <li>
                Cambió de opinión tras hablar con{' '}
                <button className="inline-link" onClick={() => renderer?.select(reaction.revisedBy!)}>
                  {firstName(reaction.revisedBy)}
                </button>{' '}
                (antes: «{reaction.previous.speech}»).
              </li>
            )}
            {!reaction.revisedBy && reaction.previous && <li>{RESIDENTS.find((p) => p.id === reaction.rumors.at(-1)?.fromId)?.name.split(' ')[0]} intentó convencerle, pero no cambió de idea.</li>}
          </ul>
        </div>
      )
    }
  }
}
