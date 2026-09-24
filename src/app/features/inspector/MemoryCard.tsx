import { useTown } from '../../store'
import { town } from '../../town'
import { Avatar } from '../../shared/Avatar'

const times = (n: number) => (n === 1 ? 'una vez' : `${n} veces`)

/** What this resident remembers personally: who fooled them, who passed them lies and who they owe a warning. */
export function MemoryCard({ id }: { id: string }) {
  useTown((s) => s.memoryEntries)
  const foolers = town.memory.foolers(id)
  const people = [...town.memory.bondsOf(id)].flatMap(([other, b]) => [
    ...(b.misled ? [{ other, text: `Le pasó ${b.misled === 1 ? 'una mentira' : `${b.misled} mentiras`} que se creyó`, grudge: true }] : []),
    ...(b.warned ? [{ other, text: `Le avisó a tiempo ${times(b.warned)}: se lo debe`, grudge: false }] : []),
  ])
  if (!foolers.length && !people.length) return null
  return (
    <section>
      <h3 className="section-label">Lo que recuerda</h3>
      {foolers.length > 0 && <p className="need-line">Le engañaron con pregones: {foolers.map((f) => `${town.speakerShort(f.speaker)} (${times(f.times)})`).join(', ')}.</p>}
      {people.length > 0 && (
        <ul className="relations">
          {people.map(({ other, text, grudge }) => {
            const p = town.content.residents.find((r) => r.id === other)
            if (!p) return null
            return (
              <li key={`${other}-${grudge}`}>
                <button onClick={() => town.select(other)} onMouseEnter={() => town.highlight(other)} onMouseLeave={() => town.highlight(null)}>
                  <Avatar look={p.look} size={30} />
                  <span className="rel-text">
                    <span className="rel-name">{p.name}</span>
                    <span className="rel-label">{text}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
