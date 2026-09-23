import { RESIDENTS } from '../data/residents'
import { useTown } from '../store'
import { Avatar } from './Avatar'

export function Timeline() {
  const announcement = useTown((s) => s.announcement)
  const renderer = useTown((s) => s.renderer)
  const selectedId = useTown((s) => s.selectedId)

  return (
    <section className="timeline panel" aria-label="Reacciones de los residentes">
      <div className="tl-title">
        <h2>Reacciones</h2>
        <p>{announcement ? 'Esperando a que el pueblo decida…' : 'Transmite un anuncio para ver cómo decide cada residente.'}</p>
      </div>
      <dl className="tl-stats">
        <div>
          <dt>Decidieron</dt>
          <dd className="mono">
            0<span>/{RESIDENTS.length}</span>
          </dd>
        </div>
        <div>
          <dt>Mediana</dt>
          <dd className="mono is-empty">—</dd>
        </div>
        <div>
          <dt>Más lento</dt>
          <dd className="mono is-empty">—</dd>
        </div>
      </dl>
      <ul className="tl-people">
        {RESIDENTS.map((r) => (
          <li key={r.id}>
            <button
              className={`tl-person ${announcement ? 'is-pending' : ''} ${selectedId === r.id ? 'is-selected' : ''}`}
              onClick={() => renderer?.select(r.id)}
              onMouseEnter={() => renderer?.highlight(r.id)}
              onMouseLeave={() => renderer?.highlight(null)}
              aria-label={r.name}
              data-name={r.name.split(' ')[0]}
            >
              <Avatar look={r.look} size={30} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
