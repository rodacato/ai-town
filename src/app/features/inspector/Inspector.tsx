import { useEffect, useState } from 'react'
import { RESIDENTS } from '../../../worlds/serena/residents'
import { useTown } from '../../store'
import { Avatar } from '../../shared/Avatar'
import { ReactionDetail } from './ReactionDetail'
import { Brain, Close } from '../../shared/icons'
import { statusOf } from '../../../core/sim/status'

export function Inspector({ id }: { id: string }) {
  const renderer = useTown((s) => s.renderer)
  const sim = useTown((s) => s.sim)
  const reaction = useTown((s) => s.reactions[id])
  const profile = RESIDENTS.find((r) => r.id === id)!
  const [status, setStatus] = useState('')

  useEffect(() => {
    const r = sim.get(id)!
    const tick = () => setStatus(statusOf(r))
    tick()
    const t = window.setInterval(tick, 400)
    return () => window.clearInterval(t)
  }, [id, sim])

  return (
    <div className="panel-view inspector">
      <button className="icon-btn close" onClick={() => renderer?.select(null)} aria-label="Cerrar ficha" data-tip-left="Cerrar  Esc">
        <Close />
      </button>
      <div className="inspector-head">
        <Avatar look={profile.look} size={64} />
        <div>
          <h2>{profile.name}</h2>
          <p className="rc-meta">
            {profile.age} años · {profile.occupation}
          </p>
        </div>
      </div>
      <p className="rc-status">
        <span className="live-dot" />
        {status}
      </p>

      <section className="reaction">
        <h3 className="section-label">
          <Brain width={13} height={13} /> Su reacción
        </h3>
        <ReactionDetail reaction={reaction} name={profile.name} />
      </section>

      <section>
        <h3 className="section-label">Sobre {profile.name.split(' ')[0]}</h3>
        <p className="rc-bio">{profile.bio}</p>
        <div className="chips">
          {profile.traits.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="section-label">Relaciones</h3>
        <ul className="relations">
          {profile.relationships.map((rel) => {
            const other = RESIDENTS.find((p) => p.id === rel.id)!
            return (
              <li key={rel.id}>
                <button onClick={() => renderer?.select(rel.id)} onMouseEnter={() => renderer?.highlight(rel.id)} onMouseLeave={() => renderer?.highlight(null)}>
                  <Avatar look={other.look} size={30} />
                  <span className="rel-text">
                    <span className="rel-name">{other.name}</span>
                    <span className="rel-label">{rel.label}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
