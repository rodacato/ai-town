import { useEffect, useState } from 'react'
import { useTown } from '../../store'
import { Avatar } from '../../shared/Avatar'
import { NeedsCard } from './NeedsCard'
import { PersonalityCard } from './PersonalityCard'
import { ReactionDetail } from './ReactionDetail'
import { Brain, Close } from '../../shared/icons'
import { statusOf } from '../../../core/sim/status'
import { town } from '../../town'
import './inspector.css'
import { firstName } from '../../../core/lang'

export function Inspector({ id }: { id: string }) {
  const reaction = useTown((s) => s.reactions[id])
  const profile = town.content.residents.find((r) => r.id === id)!
  const [status, setStatus] = useState('')

  useEffect(() => {
    const r = town.sim.get(id)!
    const tick = () => setStatus(statusOf(town.sim, r))
    tick()
    const t = window.setInterval(tick, 400)
    return () => window.clearInterval(t)
  }, [id])

  return (
    <div className="panel-view inspector">
      <button className="icon-btn close" onClick={() => town.select(null)} aria-label="Cerrar ficha" data-tip-left="Cerrar  Esc">
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
        <h3 className="section-label">Sobre {firstName(profile.name)}</h3>
        <p className="rc-bio">{profile.bio}</p>
        <div className="chips">
          {profile.traits.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      </section>

      <NeedsCard id={id} />

      <PersonalityCard personality={profile.personality} name={firstName(profile.name)} />

      <section>
        <h3 className="section-label">Relaciones</h3>
        <ul className="relations">
          {profile.relationships.map((rel) => {
            const other = town.content.residents.find((p) => p.id === rel.id)!
            return (
              <li key={rel.id}>
                <button onClick={() => town.select(rel.id)} onMouseEnter={() => town.highlight(rel.id)} onMouseLeave={() => town.highlight(null)}>
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
