import { useState } from 'react'
import { compareSides, type DecisionChange, type MetricDelta } from '../../../core/bench/compare'
import { firstName } from '../../../core/lang'
import { ACTION_META } from '../../../theme/actions'
import { Alert } from '../../shared/icons'
import { town } from '../../town'
import { seconds, usd } from '../experiment/summary'
import { useBench } from './benchStore'

const VERDICT = { better: 'mejor', worse: 'peor', same: 'igual', 'n/a': '—' }

function format(v: number | null, unit: MetricDelta['unit']) {
  if (v === null) return '—'
  if (unit === 'pct') return `${Math.round(v * 100)}%`
  if (unit === 'ms') return seconds(v)
  if (unit === 'usd') return usd(v)
  return v.toFixed(1)
}

function delta(m: MetricDelta) {
  if (m.base === null || m.next === null) return ''
  if (m.unit === 'pct') {
    const pts = Math.round((m.next - m.base) * 100)
    return `${pts > 0 ? '+' : ''}${pts} pts`
  }
  if (m.base === 0) return ''
  const rel = Math.round(((m.next - m.base) / Math.abs(m.base)) * 100)
  return `${rel > 0 ? '+' : ''}${rel}%`
}

/** Pick any contender of any saved run as "before" and "after", and see what moved. */
export function CompareRuns() {
  const runs = useBench((s) => s.runs)
  const options = runs.flatMap((run) => run.contenders.map((c) => ({ key: `${run.id}|${c.id}`, run, contender: c.id, label: `${new Date(run.createdAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'medium' })} · ${c.label}` })))
  const llmFirst = [...options].sort((a, b) => Number(a.contender === 'rules') - Number(b.contender === 'rules'))
  const [baseKey, setBase] = useState(llmFirst[1]?.key ?? llmFirst[0]?.key)
  const [nextKey, setNext] = useState(llmFirst[0]?.key)
  const base = options.find((o) => o.key === baseKey)
  const next = options.find((o) => o.key === nextKey)
  if (options.length < 2) return <p className="empty-note">Necesitas al menos dos contendientes guardados, en una o varias pruebas, para comparar.</p>

  const cmp = base && next ? compareSides(base, next) : null
  const byScenario = new Map<string, DecisionChange[]>()
  for (const c of cmp?.changes ?? []) byScenario.set(c.scenario, [...(byScenario.get(c.scenario) ?? []), c])
  const scenarioText = (id: string) => [...(base?.run.scenarios ?? []), ...(next?.run.scenarios ?? [])].find((s) => s.id === id)?.text ?? id
  const name = (id: string) => firstName(town.content.residents.find((r) => r.id === id)?.name ?? id)

  return (
    <div className="bench-compare">
      <div className="compare-pickers">
        {(
          [
            ['Antes', baseKey, setBase],
            ['Después', nextKey, setNext],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="field">
            <span className="field-label">{label}</span>
            <select className="input" value={value} onChange={(e) => set(e.target.value)}>
              {runs.map((run) => (
                <optgroup key={run.id} label={`${new Date(run.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} · ${run.scenarios.length} pregones × ${run.repetitions}`}>
                  {run.contenders.map((c) => (
                    <option key={c.id} value={`${run.id}|${c.id}`}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
      </div>

      {cmp && cmp.caveats.length > 0 && (
        <div className="notice">
          <Alert width={16} height={16} />
          <p>{cmp.caveats.join(' ')}</p>
        </div>
      )}

      {cmp && (
        <>
          <div className="table-scroll">
            <table className="bench-table compare-table">
              <thead>
                <tr>
                  <th scope="col">Métrica</th>
                  <th scope="col">Antes</th>
                  <th scope="col">Después</th>
                  <th scope="col">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {cmp.metrics
                  .filter((m) => m.base !== null || m.next !== null)
                  .map((m) => (
                    <tr key={m.id}>
                      <th scope="row">{m.label}</th>
                      <td className="mono">{format(m.base, m.unit)}</td>
                      <td className="mono">{format(m.next, m.unit)}</td>
                      <td className={`mono verdict-${m.verdict}`}>
                        {delta(m)} {m.verdict !== 'n/a' && <span className="verdict">{VERDICT[m.verdict]}</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <section>
            <h3 className="section-label">Decisiones que cambiaron</h3>
            <p className="compare-summary">
              {cmp.compared === 0 ? (
                'No hay residentes en común para comparar.'
              ) : (
                <>
                  <b className="mono">{cmp.changes.length}</b> de <b className="mono">{cmp.compared}</b> decisiones cambiaron (la acción más común de cada residente en cada pregón).
                </>
              )}
            </p>
            {[...byScenario].map(([scenario, changes]) => (
              <div key={scenario} className="scenario-result">
                <p>{scenarioText(scenario)}</p>
                <ul className="changes">
                  {changes.map((c) => (
                    <li key={c.resident}>
                      <span className="change-name">{name(c.resident)}</span>
                      <span className="action-dot" style={{ background: ACTION_META[c.base].css }} /> {ACTION_META[c.base].short}
                      <span className="muted"> → </span>
                      <span className="action-dot" style={{ background: ACTION_META[c.next].css }} /> {ACTION_META[c.next].short}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
