import type { Reaction } from '../../../core/reactions/engine'
import { useTown } from '../../store'
import { ActionPill } from '../../shared/ActionPill'
import { STAGE_LABEL, thinkingStage } from '../experiment/stages'
import { firstName, seconds } from '../experiment/summary'
import { Exchange } from './Exchange'
import { useNow } from '../../shared/useNow'
import { town } from '../../town'

export function ReactionDetail({ reaction, name }: { reaction: Reaction | undefined; name: string }) {
  const now = useNow(reaction?.phase === 'thinking')
  const streamed = useTown((s) => (reaction ? s.reasoning[reaction.id] : undefined))
  const first = name.split(' ')[0]
  const noun = town.content.copy.noun

  if (!reaction) return <div className="reaction-body is-empty">Todavía no hay {noun}. Cuando haya uno, aquí verás qué decide {first} y por qué.</div>
  if (reaction.isSpeaker) return <div className="reaction-body is-empty">{first} hizo el {noun}.</div>

  switch (reaction.phase) {
    case 'unaware':
      return <div className="reaction-body is-empty">Todavía no le ha llegado el {noun}.</div>
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
            {STAGE_LABEL[thinkingStage(reaction)]}
            <span className="mono">{seconds(now - (reaction.startedAt ?? reaction.queuedAt ?? now))}</span>
          </div>
          {streamed && (
            <p className="reasoning is-streaming">
              {streamed}
              <span className="caret" />
            </p>
          )}
          <Exchange reaction={reaction} now={now} />
        </div>
      )
    case 'error':
      return (
        <div className="reaction-body is-error">
          <p>No pudo decidir: {reaction.error}</p>
          <button className="btn-link" onClick={() => town.retry([reaction.id])}>
            Reintentar
          </button>
        </div>
      )
    case 'decided': {
      const d = reaction.decision!
      const via = reaction.heardVia && reaction.heardVia !== 'broadcast' ? `de boca de ${firstName(reaction.heardVia)}` : `por el ${noun}`
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
                    <button className="inline-link" onClick={() => town.select(id)}>
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
                <button className="inline-link" onClick={() => town.select(reaction.revisedBy!)}>
                  {firstName(reaction.revisedBy)}
                </button>{' '}
                (antes: «{reaction.previous.speech}»).
              </li>
            )}
            {!reaction.revisedBy && reaction.previous && <li>{town.content.residents.find((p) => p.id === reaction.rumors.at(-1)?.fromId)?.name.split(' ')[0]} intentó convencerle, pero no cambió de idea.</li>}
          </ul>
          <Exchange reaction={reaction} />
        </div>
      )
    }
  }
}
