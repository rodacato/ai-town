import { useTown } from '../../store'
import { town } from '../../town'
import './realm.css'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** The realm at a glance: how much the Baroness is trusted, the treasury, the granary and the town's spirits. */
export function RealmHud() {
  const realm = useTown((s) => s.realm)
  useTown((s) => s.memoryEntries)
  if (!realm) return null
  const trust = town.memory.reputation({ kind: 'authority' }).trust
  const low = (x: number, bad: number) => (x < bad ? 'is-low' : '')
  return (
    <section className="realm-hud panel" aria-label="Estado del reino">
      <div className={`realm-stat ${low(trust, 0.35)}`} title="Confianza del pueblo en la Baronesa">
        <span aria-hidden>👑</span>
        <b className="mono">{pct(trust)}</b>
      </div>
      <div className="realm-stat" title="Tesoro real">
        <span aria-hidden>💰</span>
        <b className="mono">{realm.treasury}</b>
      </div>
      <div className={`realm-stat ${low(realm.foodDays, 2)}`} title={`Granero: ${realm.granary} raciones, para unos ${realm.foodDays.toFixed(1)} días`}>
        <span aria-hidden>🍞</span>
        <b className="mono">{realm.granary}</b>
        <span className="realm-sub">{Number.isFinite(realm.foodDays) ? `${realm.foodDays.toFixed(1)} d` : ''}</span>
      </div>
      <div className={`realm-stat ${low(realm.mood, 0.4)}`} title="Ánimo medio del pueblo">
        <span aria-hidden>🙂</span>
        <b className="mono">{pct(realm.mood)}</b>
      </div>
      {realm.hungry > 0 && (
        <div className="realm-stat is-low" title="Pasan hambre">
          <span aria-hidden>🥣</span>
          <b className="mono">{realm.hungry}</b>
        </div>
      )}
      {realm.gone.length + realm.dead.length > 0 && (
        <div className="realm-stat is-low" title={`${realm.dead.length} muertos, ${realm.gone.length} se fueron`}>
          <span aria-hidden>🪦</span>
          <b className="mono">{realm.dead.length + realm.gone.length}</b>
        </div>
      )}
      <span className="realm-day mono">Día {realm.day + 1}</span>
    </section>
  )
}
