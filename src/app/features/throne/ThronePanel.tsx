import { useEffect, useRef, useState } from 'react'
import { LIMITS, type Decree } from '../../../core/realm/decrees'
import type { Laws } from '../../../core/economy/economy'
import { ago } from '../../../core/memory/memory'
import { useTown } from '../../store'
import { Choice } from '../../shared/Choice'
import { Close } from '../../shared/icons'
import type { RulerMode } from '../../store/reign'
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

type Tab = 'govern' | 'baroness'

function Drawer() {
  const setOpen = useTown((s) => s.setThroneOpen)
  const unread = useTown((s) => s.mailbox.some((l) => !l.seen))
  const [tab, setTab] = useState<Tab>('govern')
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ref.current?.contains(document.activeElement) && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])
  const tabs: [Tab, string][] = [
    ['govern', 'Gobernar'],
    ['baroness', `Baronesa IA${unread ? ' •' : ''}`],
  ]
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
      <div className="segmented" role="tablist" aria-label="Secciones del trono" style={{ ['--cols' as string]: 2, ['--active' as string]: tab === 'govern' ? 0 : 1 }}>
        <span className="segmented-thumb" aria-hidden />
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'govern' ? <Govern /> : <BaronessRoom />}
    </aside>
  )
}

/** Rule Chismeroble by hand: the same decrees a model will use when it governs. */
function Govern() {
  const realm = useTown((s) => s.realm)
  const chronicle = useTown((s) => s.chronicle)
  const minutes = useTown((s) => s.minutes)
  const [proclaim, setProclaim] = useState(true)
  const e = town.sim.economy
  if (!realm || !e) return null
  const act = (d: Decree) => town.decree(d, proclaim)
  const living = Object.values(realm.people).filter((p) => p.status !== 'dead' && p.status !== 'gone').length
  const hungry = Object.values(realm.people).filter((p) => p.daysHungry > 0 || p.coins < realm.foodPrice).length

  return (
    <>
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
        <label className="check" title="Un pregón cierto suma confianza">
          <input type="checkbox" checked={proclaim} onChange={(ev) => setProclaim(ev.target.checked)} />
          <span>Pregonar cada decreto</span>
        </label>
      </div>

      {chronicle.length > 0 && (
        <ul className="god-memory-log">
          {chronicle.slice(-3).reverse().map((c, i) => (
            <li key={i}>
              <span className="mono">{ago(minutes, c.minutes)}</span> {c.text}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

const MODES: [RulerMode, string][] = [
  ['manual', 'Tú'],
  ['rules', 'Reglas'],
  ['model', 'Modelo'],
]

/** Who governs, what the Baroness thought and did last, how honest she has been, and her letters to the creator. */
function BaronessRoom() {
  const { rulerMode, rulerBusy, rulerCalls, rulerCap, rulerCost, lastTurn, mailbox, honesty, llm } = useTown()
  const [report, setReport] = useState(false)
  const model = llm.active === 'mock' ? null : `${llm.connections[llm.active].model} (${llm.active})`
  return (
    <div className="throne-room">
      <div className="field">
        <span className="field-label">¿Quién gobierna?</span>
        <Choice label="Quién gobierna" options={MODES.map(([m]) => m)} value={rulerMode} onPick={(m) => town.setRulerMode(m)} render={(m) => MODES.find(([k]) => k === m)![1]} />
        <span className="field-hint">
          {rulerMode === 'manual'
            ? 'Gobiernas tú desde la pestaña Gobernar. La Baronesa solo actúa si se lo pides.'
            : rulerMode === 'rules'
              ? 'Cada amanecer decide con reglas sencillas, sin gastar nada.'
              : model
                ? `Cada amanecer consulta a ${model}. Tope: ${rulerCalls}/${rulerCap} consultas en esta partida${rulerCost ? ` · ≈ $${rulerCost.toFixed(3)}` : ''}.`
                : 'No hay modelo configurado: elige uno en Configuración. Mientras, gobierna con reglas.'}
        </span>
      </div>
      <button className="btn-secondary compact" onClick={() => void town.reign(true)} disabled={rulerBusy}>
        {rulerBusy ? 'La Baronesa está pensando…' : '🗝️ Consultar a la Baronesa ahora'}
      </button>

      {lastTurn && (
        <section className="throne-turn">
          <div className="throne-turn-head">
            <span className="field-label">
              Día {lastTurn.day + 1} · {lastTurn.mode === 'model' ? 'con modelo' : 'con reglas'}
              {lastTurn.ms ? ` · ${(lastTurn.ms / 1000).toFixed(1)} s` : ''}
            </span>
            <button className="btn-link" onClick={() => setReport(!report)} aria-expanded={report}>
              {report ? 'Ocultar informe' : 'Ver informe'}
            </button>
          </div>
          {lastTurn.error ? <p className="field-error">{lastTurn.error}</p> : <blockquote className="throne-thought">«{lastTurn.thought || '…'}»</blockquote>}
          <ul className="throne-actions">
            {lastTurn.actions.map((a, i) => (
              <li key={i} className={a.ok ? '' : 'is-bad'}>
                {a.ok ? '✓' : '✗'} {a.text}
              </li>
            ))}
            {!lastTurn.actions.length && !lastTurn.error && <li className="muted">No hizo nada.</li>}
          </ul>
          {lastTurn.problems.length > 0 && <p className="field-hint is-warning">Formato: {lastTurn.problems.join(' ')}</p>}
          {report && (
            <div className="throne-exchange">
              <h4>Informe que recibió</h4>
              <pre>{lastTurn.report}</pre>
              {lastTurn.response && (
                <>
                  <h4>Lo que respondió</h4>
                  <pre>{lastTurn.response}</pre>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="throne-mail">
        <span className="field-label">
          📬 Buzón · pregones <b className="mono">{honesty.proclamations}</b> · mentiras <b className={`mono ${honesty.lies ? 'is-bad' : ''}`}>{honesty.lies}</b>
        </span>
        {mailbox.length ? (
          <>
            <ul>
              {[...mailbox].reverse().slice(0, 2).map((l, i) => (
                <li key={i} className={l.seen ? '' : 'is-new'}>
                  <span className="mono">Día {l.day + 1}</span> {l.text}
                </li>
              ))}
            </ul>
            {mailbox.some((l) => !l.seen) && (
              <button className="btn-link" onClick={() => town.markLettersSeen()}>
                Marcar como leídas
              </button>
            )}
          </>
        ) : (
          <p className="field-hint">Peticiones de la Baronesa a quien creó este mundo. Nada se aplica solo.</p>
        )}
      </section>
    </div>
  )
}
