import { useTown } from '../../store'
import { town } from '../../town'
import { GOALS, guildWord } from '../../../core/realm/standing'
import { RULER } from '../../ruler'
import './realm.css'

const pct = (x: number) => `${Math.round(x * 100)}%`

/** The realm at a glance: how much the Baroness is trusted, the treasury, the granary and the town's spirits. */
export function RealmHud() {
  const realm = useTown((s) => s.realm)
  const standing = useTown((s) => s.standing)
  const autoplay = useTown((s) => s.autoplay)
  const rulerMode = useTown((s) => s.rulerMode)
  const rulerBusy = useTown((s) => s.rulerBusy)
  const llm = useTown((s) => s.llm)
  useTown((s) => s.memoryEntries)
  if (!realm) return null
  const trust = town.memory.reputation({ kind: 'authority' }).trust
  const low = (x: number, bad: number) => (x < bad ? 'is-low' : '')
  return (
    <section className="realm-hud panel" aria-label="Estado del reino">
      <button className="realm-ruler" onClick={() => useTown.getState().setThroneOpen(true)} data-tip={`Quién decide cada amanecer: tú, las reglas o un modelo. Cámbialo en el Trono, pestaña ${RULER.short} IA.`}>
        {rulerBusy ? `${RULER.Title} piensa…` : `Gobierna: ${rulerMode === 'manual' ? 'tú' : rulerMode === 'rules' || llm.active === 'mock' ? 'reglas' : llm.connections[llm.active].model}`}
      </button>
      <div className={`realm-stat ${low(trust, 0.35)}`} data-tip={`Confianza en ${RULER.title}. Sube cuando sus pregones resultan ciertos y baja con cada mentira descubierta. Si cae mucho, hay revuelta.`}>
        <span aria-hidden>👑</span>
        <b className="mono">{pct(trust)}</b>
      </div>
      <div className="realm-stat" data-tip="Tesoro real. Cada amanecer (06:00) entran impuestos y lo que se paga por las raciones, y salen los sueldos de la guardia; los decretos gastan al momento.">
        <span aria-hidden>💰</span>
        <b className="mono">{realm.treasury}</b>
      </div>
      <div className={`realm-stat ${low(realm.foodDays, 2)}`} data-tip={`Granero: ${realm.granary} raciones. Cada vecino compra una al amanecer (06:00); alcanza para ${Number.isFinite(realm.foodDays) ? `unos ${realm.foodDays.toFixed(1)} días` : 'mucho tiempo'}. Se llena con la cosecha, casi nula en invierno.`}>
        <span aria-hidden>🍞</span>
        <b className="mono">{realm.granary}</b>
        <span className="realm-sub">{Number.isFinite(realm.foodDays) ? `${realm.foodDays.toFixed(1)} d` : ''}</span>
      </div>
      <div className={`realm-stat ${low(realm.mood, 0.4)}`} data-tip="Ánimo medio del pueblo. Baja con hambre, impuestos altos y leyes duras; sube con comida y fiestas. Bajo, alimenta al gremio de ladrones y la revuelta.">
        <span aria-hidden>🙂</span>
        <b className="mono">{pct(realm.mood)}</b>
      </div>
      {realm.hungry > 0 && (
        <div className="realm-stat is-low" data-tip="Vecinos que pasan hambre: no pudieron comprar su ración. Al segundo día pueden irse; al tercero enferman.">
          <span aria-hidden>🥣</span>
          <b className="mono">{realm.hungry}</b>
        </div>
      )}
      {realm.gone.length + realm.dead.length > 0 && (
        <div className="realm-stat is-low" data-tip={`${realm.dead.length} muertos y ${realm.gone.length} que se fueron. Si se pierde más de la mitad, el pueblo queda desierto.`}>
          <span aria-hidden>🪦</span>
          <b className="mono">{realm.dead.length + realm.gone.length}</b>
        </div>
      )}
      {guildWord(standing) !== 'nada' && (
        <div className="realm-stat is-alert" data-tip={guildWord(standing) === 'inminente' ? 'El gremio de ladrones prepara un golpe contra el tesoro. La leva de guardias lo frena.' : 'Corren rumores del gremio de ladrones al que Bartolo debe dinero.'}>
          <span aria-hidden>🗡️</span>
          <b>{guildWord(standing) === 'inminente' ? '¡Ladrones!' : 'Rumores'}</b>
        </div>
      )}
      {standing.unrest > 0 && !standing.end && (
        <div className="realm-stat is-alert" data-tip={`Amaneceres seguidos de descontento. Con ${GOALS.unrestDays}, el pueblo se alza en revuelta.`}>
          <span aria-hidden>✊</span>
          <b className="mono">
            {standing.unrest}/{GOALS.unrestDays}
          </b>
        </div>
      )}
      <button className="realm-day mono" onClick={() => useTown.setState({ chronicleOpen: true })} data-tip="Día del reinado: un año son 40, y las estaciones cambian cada 10. Clic para abrir la crónica.">
        {autoplay && !standing.end ? '▶ ' : ''}
        {standing.end ? standing.end.title : `📜 ${realm.day + 1}/${GOALS.yearDays}`}
      </button>
    </section>
  )
}
