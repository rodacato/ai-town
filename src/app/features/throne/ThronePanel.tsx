import { useEffect, useRef, useState } from 'react'
import { LIMITS, type Decree } from '../../../core/realm/decrees'
import type { Laws } from '../../../core/economy/economy'
import { ago } from '../../../core/memory/memory'
import { useTown } from '../../store'
import { Choice } from '../../shared/Choice'
import { Close } from '../../shared/icons'
import { TrustMeter } from '../../shared/TrustMeter'
import { town } from '../../town'
import '../god/god.css'
import './throne.css'

const TAXES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
const PRICES = [0, 1, 2, 3, 4, 6]
const LAWS: [keyof Laws, string, string][] = [
  ['curfew', 'Toque de queda', 'Nadie en la calle de 20:00 a 6:00. Más seguro, pero molesta.'],
  ['rationing', 'Racionamiento', 'Media ración: el granero dura el doble, a costa de salud y ánimo.'],
  ['levy', 'Leva de guardias', 'Dos guardias más: los ladrones y las bestias hacen menos daño.'],
]

export function ThronePanel() {
  const open = useTown((s) => s.throneOpen)
  if (!open) return null
  return <Drawer />
}

/** Rule Chismeroble by hand: the same decrees a model will use when it governs. */
function Drawer() {
  const realm = useTown((s) => s.realm)
  const chronicle = useTown((s) => s.chronicle)
  const minutes = useTown((s) => s.minutes)
  const setOpen = useTown((s) => s.setThroneOpen)
  const [proclaim, setProclaim] = useState(true)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ref.current?.contains(document.activeElement) && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])
  const e = town.sim.economy
  if (!realm || !e) return null
  const act = (d: Decree) => town.decree(d, proclaim)
  const living = Object.values(realm.people).filter((p) => p.status !== 'dead' && p.status !== 'gone').length
  const hungry = Object.values(realm.people).filter((p) => p.daysHungry > 0 || p.coins < realm.foodPrice).length

  return (
    <aside className="god-panel panel throne" ref={ref} aria-label="Trono">
      <header className="god-head">
        <h2>
          <span aria-hidden>👑</span> Trono de la Baronesa
        </h2>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar el trono">
          <Close />
        </button>
      </header>
      <TrustMeter speaker={{ kind: 'authority' }} label="Confianza en ti" />
      <div className="throne-coffers">
        <span>
          💰 <b className="mono">{realm.treasury}</b> monedas
        </span>
        <span>
          🍞 <b className="mono">{Math.floor(realm.granary)}</b> raciones ({Number.isFinite(realm.foodDays) ? realm.foodDays.toFixed(1) : '∞'} días)
        </span>
      </div>

      <div className="field">
        <span className="field-label">Impuesto</span>
        <Choice label="Impuesto" options={TAXES} value={realm.taxRate} onPick={(rate) => act({ kind: 'tax', rate })} render={(r) => `${Math.round(r * 100)}%`} />
      </div>
      <div className="field">
        <span className="field-label">Precio de la ración</span>
        <Choice label="Precio de la ración" options={PRICES} value={realm.foodPrice} onPick={(price) => act({ kind: 'price', price })} render={(p) => (p === 0 ? 'Gratis' : `${p}`)} />
      </div>

      <div className="god-grid">
        <button className="btn-secondary compact" onClick={() => act({ kind: 'handout' })} disabled={!hungry}>
          🥣 Repartir{hungry ? ` · ${hungry}` : ''}
        </button>
        <button className="btn-secondary compact" onClick={() => act({ kind: 'buyFood', rations: 30 })} disabled={realm.treasury < 30 * LIMITS.rationCost}>
          🛒 30 raciones · {30 * LIMITS.rationCost}💰
        </button>
        <button className="btn-secondary compact" onClick={() => act({ kind: 'bonus', coins: 3 })} disabled={realm.treasury < 3 * living}>
          🎁 Paga de 3 · {3 * living}💰
        </button>
        <button className="btn-secondary compact" onClick={() => act({ kind: 'festival' })} disabled={realm.treasury < LIMITS.festivalGold || realm.granary < LIMITS.festivalFood}>
          🎉 Fiesta · {LIMITS.festivalGold}💰 {LIMITS.festivalFood}🍞
        </button>
      </div>

      <div className="throne-laws">
        {LAWS.map(([law, label, hint]) => (
          <label key={law} className="check" title={hint}>
            <input type="checkbox" checked={e.laws[law]} onChange={(ev) => act({ kind: 'law', law, on: ev.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <label className="check">
        <input type="checkbox" checked={proclaim} onChange={(ev) => setProclaim(ev.target.checked)} />
        <span>Pregonar cada decreto (un pregón cierto suma confianza)</span>
      </label>

      {chronicle.length > 0 && (
        <ul className="god-memory-log">
          {chronicle.slice(-4).reverse().map((c, i) => (
            <li key={i}>
              <span className="mono">{ago(minutes, c.minutes)}</span> {c.text}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
