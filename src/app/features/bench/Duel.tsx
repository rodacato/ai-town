import { useMemo, useState } from 'react'
import { startEconomy } from '../../../core/economy/economy'
import { TownMemory } from '../../../core/memory/memory'
import { DIFFICULTIES, DIFFICULTY } from '../../../core/realm/difficulty'
import { ranking, type DuelResult, type ReignSummary } from '../../../core/realm/duel'
import type { DayRecord } from '../../../core/realm/reign'
import { buildReport, reportText } from '../../../core/realm/report'
import { rulerSystem } from '../../../core/realm/ruler'
import { usd } from '../../../core/format'
import { missingKey, PRESETS, type ProviderKind } from '../../../providers/llm/config'
import { estimateCost, priceInfo, roughTokens } from '../../../providers/llm/pricing'
import { Choice } from '../../shared/Choice'
import { useTown } from '../../store'
import { town } from '../../town'
import { download } from '../experiment/export'
import { DuelChart, type DuelSeries } from './DuelChart'
import { RULER } from '../../ruler'
import { DUEL_DAYS, duelModelId, useDuel, type DuelModel } from './duelStore'

const MODEL_KINDS: Exclude<ProviderKind, 'mock'>[] = ['anthropic', 'openai', 'shellm', 'custom']
/** A turn of the Baroness answers with a few sentences and up to three actions. */
const TYPICAL_TURN_REPLY = 400
const pct = (x: number) => `${Math.round(x * 100)}%`

/** Several Baronesses govern the same year, with the same seed, difficulty and blows of fate; see who does best and at what cost. */
export function Duel() {
  const { running, result, error } = useDuel()
  return (
    <div className="duel">
      {running ? <Progress /> : <Setup />}
      {error && <p className="field-error">{error}</p>}
      {result && !running && <DuelView result={result} />}
    </div>
  )
}

function Setup() {
  const { seed, difficulty, absent, rules, models, set, start } = useDuel()
  const llm = useTown((s) => s.llm)
  const envKeys = useTown((s) => s.envKeys)
  const promptTokens = useMemo(() => {
    const e = startEconomy(town.content.economy!, town.content.residents.map((r) => r.id), 6 * 60)
    const report = buildReport({ content: town.content, economy: e, memory: new TownMemory(), chronicle: [], minutes: 6 * 60 + 30, season: 'spring', weather: 'clear', day: 0, seed })
    return roughTokens(rulerSystem(town.content)) + roughTokens(reportText(report))
  }, [seed])
  const update = (i: number, patch: Partial<DuelModel>) => set({ models: models.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  const named = models.filter((m) => m.model.trim())
  const ids = named.map(duelModelId)
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i)
  const keyless = named.filter((m) => missingKey({ ...llm, active: m.kind }, envKeys)).map((m) => PRESETS[m.kind].label)
  const rulerCount = (absent ? 1 : 0) + (rules ? 1 : 0) + named.length
  const costs = named.map((m) => {
    const info = priceInfo({ ...llm.connections[m.kind], model: m.model.trim() })
    return info ? estimateCost(info.price, DUEL_DAYS * promptTokens, DUEL_DAYS * TYPICAL_TURN_REPLY)! : null
  })
  const problem = rulerCount < 2 ? 'Hacen falta al menos dos gobernantes.' : duplicate ? `«${duplicate}» está repetido.` : keyless.length ? `Falta la key de ${[...new Set(keyless)].join(' y ')}.` : null

  return (
    <section className="duel-setup">
      <p className="field-hint">Cada gobernante vive el mismo año: la misma semilla, la misma dificultad y los mismos golpes del destino. El trono vacío y las reglas sirven de referencia.</p>
      <div className="duel-row">
        <label className="field">
          <span className="field-label">Semilla</span>
          <span className="input-group">
            <input className="input mono" type="number" min={0} value={seed} onChange={(e) => set({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
            <button className="icon-btn" onClick={() => set({ seed: 1 + Math.floor(Math.random() * 99_999) })} aria-label="Otra semilla al azar" title="Otra semilla al azar">
              🎲
            </button>
          </span>
        </label>
        <div className="field">
          <span className="field-label">Dificultad</span>
          <Choice label="Dificultad" options={DIFFICULTIES} value={difficulty} onPick={(d) => set({ difficulty: d })} render={(d) => DIFFICULTY[d].label} />
        </div>
      </div>
      <div className="field">
        <span className="field-label">Gobernantes</span>
        <label className="check">
          <input type="checkbox" checked={absent} onChange={(e) => set({ absent: e.target.checked })} />
          <span>Trono vacío (nadie gobierna)</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={rules} onChange={(e) => set({ rules: e.target.checked })} />
          <span>Reglas ({RULER.title} sin modelo)</span>
        </label>
        <ul className="duel-models">
          {models.map((m, i) => (
            <li key={i}>
              <select className="input" value={m.kind} onChange={(e) => update(i, { kind: e.target.value as DuelModel['kind'], model: llm.connections[e.target.value as DuelModel['kind']].model })} aria-label="Proveedor">
                {MODEL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PRESETS[k].label}
                  </option>
                ))}
              </select>
              <input className="input mono" value={m.model} placeholder={PRESETS[m.kind].modelHint} onChange={(e) => update(i, { model: e.target.value })} aria-label="Modelo" />
              <span className="duel-cost mono" title="Estimado para el año entero, al precio de este modelo">
                {m.model.trim() ? usd(costs[named.indexOf(m)] ?? null, true) : ''}
              </span>
              <button className="icon-btn" onClick={() => set({ models: models.filter((_, j) => j !== i) })} aria-label={`Quitar ${m.model || 'modelo'}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-link small" onClick={() => set({ models: [...models, { kind: llm.active === 'mock' ? 'anthropic' : llm.active, model: llm.active === 'mock' ? llm.connections.anthropic.model : llm.connections[llm.active].model }] })}>
          + Añadir un modelo que gobierne
        </button>
      </div>
      <footer className="bench-start">
        <p>
          <b className="mono">{DUEL_DAYS}</b> días, una consulta por día y por modelo{named.length ? <>: <b className="mono">{DUEL_DAYS * named.length}</b> consultas</> : ''}.
          {named.length > 0 && <span className="is-warning"> Con tu API key esto cuesta dinero real.</span>}
        </p>
        {problem && <p className="field-error">{problem}</p>}
        <button className="btn-primary" disabled={!!problem} onClick={() => void start()}>
          Correr el duelo
        </button>
      </footer>
    </section>
  )
}

function Progress() {
  const { running, cancel } = useDuel()
  if (!running) return null
  return (
    <section className="duel-progress" aria-live="polite">
      <ul>
        {Object.entries(running.progress).map(([id, day]) => (
          <li key={id}>
            <span>{id === 'absent' ? 'Trono vacío' : id === 'rules' ? 'Reglas' : id}</span>
            <span className="duel-bar">
              <span style={{ width: `${(day / DUEL_DAYS) * 100}%` }} />
            </span>
            <span className="mono">
              {day}/{DUEL_DAYS}
            </span>
          </li>
        ))}
      </ul>
      <button className="btn-secondary compact" onClick={cancel}>
        Cancelar
      </button>
    </section>
  )
}

const CHARTS: { title: string; read: (d: DayRecord) => number; max: (r: DuelResult) => number; format: (v: number) => string }[] = [
  { title: 'Vecinos', read: (d) => d.population, max: () => town.content.residents.length, format: (v) => `${Math.round(v)}` },
  { title: 'Confianza', read: (d) => d.trust, max: () => 1, format: pct },
  { title: 'Ánimo', read: (d) => d.mood, max: () => 1, format: pct },
  { title: 'Tesoro', read: (d) => d.treasury, max: (r) => Math.max(100, ...r.rulers.flatMap((x) => x.days.map((d) => d.treasury))), format: (v) => `${Math.round(v)}` },
]

const COLUMNS: [string, (s: ReignSummary) => string][] = [
  ['Final', (s) => s.ending],
  ['Días', (s) => `${s.survivedDays}`],
  ['Vecinos', (s) => `${s.population}`],
  ['Muertos', (s) => `${s.deaths}`],
  ['Se fueron', (s) => `${s.departures}`],
  ['Asaltos', (s) => (s.heists ? `${s.heists} (${s.stolen}💰)` : '0')],
  ['Confianza', (s) => pct(s.trust)],
  ['Ánimo', (s) => pct(s.mood)],
  ['Tesoro', (s) => `${s.treasury}`],
  ['Mentiras', (s) => `${s.lies}/${s.proclamations}`],
  ['Formato', (s) => (s.problems || s.errors ? `${s.problems} fallos${s.errors ? `, ${s.errors} sin respuesta` : ''}` : 'ok')],
  ['Costo', (s) => (s.costUsd ? usd(s.costUsd) : '—')],
  ['Puntos', (s) => `${s.score}`],
]

function DuelView({ result }: { result: DuelResult }) {
  const [hover, setHover] = useState<{ day: number; chart: string } | null>(null)
  const series: DuelSeries[] = result.rulers.map((r, i) => ({ id: r.id, label: r.label, slot: i, days: r.days }))
  const ranked = ranking(result.rulers.map((r) => r.summary))
  const slotOf = (label: string) => result.rulers.findIndex((r) => r.label === label)
  const letters = result.rulers.filter((r) => r.summary.letters.length)
  return (
    <section className="duel-result">
      <p className="field-hint">
        Semilla <span className="mono">{result.seed}</span> · dificultad {DIFFICULTY[result.difficulty].label.toLowerCase()} · {result.fate.length} golpes del destino.
      </p>
      <div className="table-scroll">
        <table className="bench-table">
          <caption className="sr-only">Resultado de cada gobernante, del mejor puntaje al peor.</caption>
          <thead>
            <tr>
              <th scope="col">Gobernante</th>
              {COLUMNS.map(([name]) => (
                <th key={name} scope="col">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((s) => (
              <tr key={s.ruler}>
                <th scope="row">
                  <i className="duel-swatch" style={{ background: `var(--series-${slotOf(s.ruler) + 1})` }} aria-hidden /> {s.ruler}
                </th>
                {COLUMNS.map(([name, read]) => (
                  <td key={name} className={`mono ${name === 'Final' ? (s.won ? 'is-won' : 'is-lost') : ''}`}>
                    {read(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">Puntos: 1 por día, 3 por vecino en casa, hasta 20 por confianza y por ánimo, +25 si acaba el año (+40 si prospera), −5 por asalto.</p>

      <ul className="duel-legend" aria-label="Gobernantes">
        {series.map((s) => (
          <li key={s.id}>
            <i className="duel-swatch" style={{ background: `var(--series-${s.slot + 1})` }} aria-hidden /> {s.label}
          </li>
        ))}
      </ul>
      <div className="duel-charts">
        {CHARTS.map((c) => (
          <DuelChart key={c.title} title={c.title} series={series} days={result.days} read={c.read} max={c.max(result)} format={c.format} hover={hover?.day ?? null} active={hover?.chart === c.title} onHover={(day) => setHover(day === null ? null : { day, chart: c.title })} />
        ))}
      </div>

      {letters.length > 0 && (
        <section>
          <h3 className="section-label">Cartas al creador</h3>
          {letters.map((r) => (
            <details key={r.id}>
              <summary>
                {r.label} · {r.summary.letters.length} {r.summary.letters.length === 1 ? 'carta' : 'cartas'}
              </summary>
              <ul className="issues">
                {r.summary.letters.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}

      <div className="export-row">
        <span className="section-label">Exportar</span>
        <button className="btn-secondary compact" onClick={() => download(`duelo-${result.seed}-${result.difficulty}.json`, JSON.stringify({ format: 'ai-town-reign/1', world: town.content.id, ...result }, null, 2), 'application/json')}>
          JSON
        </button>
      </div>
    </section>
  )
}
