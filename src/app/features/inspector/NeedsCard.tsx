import { useTown } from '../../store'

const STATUS: Record<string, string> = { ok: 'Bien', hungry: 'Con hambre', sick: 'Enfermo de hambre', gone: 'Se fue del pueblo', dead: 'Murió de hambre' }

/** How a resident is getting by: hunger, health, spirits and coins. */
export function NeedsCard({ id }: { id: string }) {
  const p = useTown((s) => s.realm?.people[id])
  if (!p) return null
  const bar = (label: string, v: number) => (
    <div className="need">
      <span>{label}</span>
      <span className="scale-track" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v} aria-label={label}>
        <span className="scale-fill" style={{ width: `${Math.round(v * 100)}%` }} />
      </span>
    </div>
  )
  const away = p.status === 'gone' || p.status === 'dead'
  return (
    <section className="needs">
      <h3 className="section-label">
        Cómo está <span className={`need-status status-${p.status}`}>{STATUS[p.status] ?? p.status}</span>
      </h3>
      {!away && (
        <>
          {bar('Salud', p.health)}
          {bar('Ánimo', p.mood)}
          <p className="need-line">
            <span className="mono">{p.coins}</span> monedas{p.daysHungry ? ` · ${p.daysHungry} ${p.daysHungry === 1 ? 'día' : 'días'} sin comer` : ''}
          </p>
        </>
      )}
    </section>
  )
}
