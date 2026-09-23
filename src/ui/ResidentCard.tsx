import { useEffect, useState } from 'react'
import type { RoutineSpot } from '../data/residents'
import { RESIDENTS } from '../data/residents'
import type { Resident } from '../sim/simulation'
import { useTown } from '../store'
import { Avatar } from './Avatar'
import { Close } from './icons'

const DESTINATION: Record<RoutineSpot, string> = {
  plaza: 'la plaza',
  fountain: 'la fuente',
  benches: 'un banco',
  cafe: 'el café',
  bakery: 'la panadería',
  shop: 'la tienda',
  townhall: 'el ayuntamiento',
  park: 'el parque',
  riverbank: 'la orilla del río',
  forest: 'el bosque',
  field: 'el huerto',
  bridge: 'el puente',
  street: 'la calle',
  home: 'casa',
  visit: 'casa de un vecino',
}

function statusOf(r: Resident) {
  if (r.mode === 'inside') return 'En casa'
  if (r.chatting) return `Charlando con ${RESIDENTS.find((p) => p.id === r.chatting)?.name.split(' ')[0]}`
  const where = r.destination ? DESTINATION[r.destination] : 'el pueblo'
  if (r.mode === 'walking') return r.destination === 'street' ? 'Dando un paseo' : `Camino a ${where}`
  return r.destination === 'street' ? 'En la calle' : `En ${where}`
}

export function ResidentCard() {
  const selectedId = useTown((s) => s.selectedId)
  const renderer = useTown((s) => s.renderer)
  const sim = useTown((s) => s.sim)
  const [status, setStatus] = useState('')
  const [shown, setShown] = useState(selectedId)
  if (selectedId && selectedId !== shown) setShown(selectedId)
  const profile = RESIDENTS.find((r) => r.id === shown)

  useEffect(() => {
    if (!selectedId) return
    const r = sim.get(selectedId)!
    const tick = () => setStatus(statusOf(r))
    tick()
    const t = window.setInterval(tick, 400)
    return () => window.clearInterval(t)
  }, [selectedId, sim])

  if (!profile) return null
  return (
    <aside className={`resident-card panel ${selectedId ? 'is-open' : ''}`} aria-label={`Ficha de ${profile.name}`}>
      <button className="icon-btn close" onClick={() => renderer?.select(null)} aria-label="Cerrar">
        <Close />
      </button>
      <div className="rc-head">
        <Avatar look={profile.look} size={56} />
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
      <p className="rc-bio">{profile.bio}</p>
      <div className="chips">
        {profile.traits.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>
      <h3 className="section-label">Relaciones</h3>
      <ul className="relations">
        {profile.relationships.map((rel) => {
          const other = RESIDENTS.find((p) => p.id === rel.id)!
          return (
            <li key={rel.id}>
              <button onClick={() => renderer?.select(rel.id)}>
                <Avatar look={other.look} size={28} />
                <span className="rel-name">{other.name}</span>
                <span className="rel-label">{rel.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
