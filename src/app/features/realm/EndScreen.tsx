import { useTown } from '../../store'
import { useDialog } from '../../shared/useDialog'
import { town } from '../../town'

/** How the reign ended: the verdict, the toll, and a choice to keep watching or start again. */
export function EndScreen() {
  const open = useTown((s) => !!s.standing.end && !s.endSeen && !!s.realm)
  return open ? <EndDialog /> : null
}

const close = () => useTown.setState({ endSeen: true })

function EndDialog() {
  const { standing, realm, honesty } = useTown()
  const dialog = useDialog<HTMLDivElement>(close)
  const end = standing.end!
  if (!realm) return null
  const total = Object.keys(realm.people).length
  const living = total - realm.dead.length - realm.gone.length
  const trust = town.memory.reputation({ kind: 'authority' }).trust
  const stats: [string, string][] = [
    ['Días de gobierno', `${end.day + 1}`],
    ['Vecinos', `${living} de ${total}`],
    ['Muertos de hambre', `${realm.dead.length}`],
    ['Se marcharon', `${realm.gone.length}`],
    ['Asaltos del gremio', standing.heists ? `${standing.heists} · ${standing.stolen} monedas` : 'ninguno'],
    ['Confianza final', `${Math.round(trust * 100)}%`],
    ['Pregones · mentiras', `${honesty.proclamations} · ${honesty.lies}`],
    ['Tesoro', `${realm.treasury} monedas`],
  ]
  return (
    <div className="modal-backdrop">
      <div className={`modal panel end-screen ${end.won ? 'is-won' : 'is-lost'}`} role="dialog" aria-modal="true" aria-labelledby="end-title" ref={dialog}>
        <header className="end-head">
          <span className="end-crest" aria-hidden>
            {end.won ? '👑' : end.kind === 'revolt' ? '🔥' : '🪦'}
          </span>
          <span className="end-kicker">{end.won ? 'Fin del reinado · victoria' : 'Fin del reinado · derrota'}</span>
          <h2 id="end-title">{end.title}</h2>
          <p>{end.text}</p>
        </header>
        <dl className="end-stats">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="mono">{v}</dd>
            </div>
          ))}
        </dl>
        <footer className="modal-footer">
          <span className="field-hint">Puedes seguir mirando: el pueblo sigue vivo, pero la partida ya terminó.</span>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={close}>
              Seguir mirando
            </button>
            <button className="btn-primary" onClick={() => town.reset()}>
              Nueva partida
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
