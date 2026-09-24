import { useCallback, useMemo } from 'react'
import { ACTIONS } from '../../../core/decisions/types'
import { trialsPerContender } from '../../../core/bench/run'
import { errorSummary, type ContenderReport } from '../../../core/bench/analysis'
import { FAIL_FAST_AFTER } from '../../../core/bench/runner'
import { RULE_LABEL } from '../../../core/bench/coherence'
import { PRESETS } from '../../../providers/llm/config'
import { ACTION_META } from '../../../theme/actions'
import { useTown } from '../../store'
import { town } from '../../town'
import { Alert, Close, Download, Plus } from '../../shared/icons'
import { useDialog } from '../../shared/useDialog'
import { download, stamp } from '../experiment/export'
import { seconds, tokens, usd } from '../experiment/summary'
import { MAX_REPETITIONS, specId, specLabel, useBench, type ContenderKind, type ContenderSpec } from './benchStore'
import type { BenchRun } from './history'
import { trialsCsv } from './exportRun'
import { CompareRuns } from './CompareRuns'
import './bench.css'
import { estimateRunCost, promptTokens } from './estimate'
import { TYPICAL_REPLY_TOKENS } from '../../../providers/llm/pricing'
import { Duel } from './Duel'
import { useDuel } from './duelStore'
import { JudgePanel } from './JudgePanel'
import { GOLDEN_SIZE, passesGolden } from '../../../core/bench/golden'
import { foldersSupported } from './folder'
import { nameOf } from '../../../core/lang'
import { cacheText } from '../../../core/reactions/metrics'

const KINDS: ContenderKind[] = ['rules', 'anthropic', 'openai', 'shellm', 'custom']
const PAID: ContenderKind[] = ['anthropic', 'openai']
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)

export function BenchModal() {
  const open = useBench((s) => s.open)
  if (!open) return null
  return <Dialog />
}

function Dialog() {
  const close = useCallback(() => useBench.getState().setOpen(false), [])
  const ref = useDialog<HTMLDivElement>(close)
  const view = useBench((s) => s.view)
  const current = useBench((s) => s.current)
  const runs = useBench((s) => s.runs)
  const setView = useBench((s) => s.setView)
  const duelRunning = useDuel((s) => !!s.running)
  const tabs: [typeof view, string][] = [
    ['new', 'Nueva prueba'],
    ...(current ? [['result', 'Resultado'] as [typeof view, string]] : []),
    ['history', `Historial${runs.length ? ` (${runs.length})` : ''}`],
    ...(runs.length ? [['compare', 'Comparar'] as [typeof view, string]] : []),
    ['duel', duelRunning ? 'Duelo…' : 'Duelo de gobernantes'],
  ]
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal panel bench-modal" role="dialog" aria-modal="true" aria-labelledby="bench-title" ref={ref}>
        <div className="modal-header">
          <div>
            <h2 id="bench-title">Banco de pruebas</h2>
            <p>Los mismos pregones, a los mismos residentes, con varios modelos. Compara decisiones, formato, velocidad y costo.</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Cerrar">
            <Close />
          </button>
        </div>
        <nav className="bench-tabs" aria-label="Secciones">
          {tabs.map(([id, label]) => (
            <button key={id} className={view === id ? 'is-active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="modal-body">
          {view === 'new' && <NewRun />}
          {view === 'result' && current && <Result run={current} />}
          {view === 'history' && <History />}
          {view === 'compare' && <CompareRuns />}
          {view === 'duel' && <Duel />}
        </div>
      </div>
    </div>
  )
}

function NewRun() {
  const { specs, scenarioIds, repetitions, seed, running, setPrefs, start } = useBench()
  const llm = useTown((s) => s.llm)
  const vaultLocked = useTown((s) => s.vaultLocked)
  const avgPrompt = useMemo(() => promptTokens(town.content, town.content.examples.filter((e) => scenarioIds.includes(e.id)), seed), [scenarioIds, seed])
  if (running) return <Progress />

  const configured = (k: ContenderKind) => k === 'rules' || !!llm.connections[k].host.trim()
  const update = (i: number, patch: Partial<ContenderSpec>) => setPrefs({ specs: specs.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const changeKind = (i: number, kind: ContenderKind) => update(i, { kind, model: kind === 'rules' ? '' : llm.connections[kind].model })
  const addSpec = () => {
    const kind = (KINDS.find((k) => k !== 'rules' && configured(k)) ?? 'rules') as ContenderKind
    setPrefs({ specs: [...specs, { kind, model: kind === 'rules' ? '' : llm.connections[kind].model }] })
  }
  const ids = specs.map(specId)
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i)
  const missingModel = specs.some((s) => s.kind !== 'rules' && !s.model.trim())
  const perModel = trialsPerContender(town.content, town.content.examples.filter((e) => scenarioIds.includes(e.id)), repetitions)
  const llmCount = specs.filter((s) => s.kind !== 'rules').length
  const costs = specs.flatMap((s) => (s.kind === 'rules' || !s.model.trim() ? [] : [{ label: specLabel(s), cost: estimateRunCost({ ...llm.connections[s.kind], model: s.model.trim() }, perModel, avgPrompt) }]))
  const priced = costs.filter((c) => c.cost !== null)
  const unpriced = costs.filter((c) => c.cost === null)
  const keyless = [...new Set(specs.flatMap((s) => (s.kind !== 'rules' && !llm.connections[s.kind].apiKey ? [PRESETS[s.kind].label] : [])))]
  const problem = !specs.length
    ? 'Añade al menos un contendiente.'
    : !scenarioIds.length
      ? 'Elige al menos un pregón.'
      : missingModel
        ? 'Falta el modelo en algún contendiente.'
        : duplicate
          ? 'Hay dos contendientes iguales.'
          : null

  return (
    <div className="bench-form">
      <section>
        <h3 className="section-label">Contendientes</h3>
        <ul className="contenders">
          {specs.map((s, i) => (
            <li key={i}>
              <select className="input" value={s.kind} onChange={(e) => changeKind(i, e.target.value as ContenderKind)} aria-label="Proveedor">
                {KINDS.map((k) => (
                  <option key={k} value={k} disabled={!configured(k)}>
                    {k === 'rules' ? 'Reglas locales' : PRESETS[k].label}
                    {configured(k) ? '' : ' (sin configurar)'}
                  </option>
                ))}
              </select>
              {s.kind === 'rules' ? (
                <span className="contender-note">Sin modelo: la referencia gratuita e instantánea.</span>
              ) : (
                <input className="input mono" value={s.model} placeholder={PRESETS[s.kind].modelHint} onChange={(e) => update(i, { model: e.target.value })} aria-label="Modelo" spellCheck={false} />
              )}
              {s.kind === 'anthropic' && (
                <label className="check contender-cache" title="Añade el mismo modelo con y sin caché para ver cuánto ahorra">
                  <input type="checkbox" checked={!!s.noCache} onChange={(e) => update(i, { noCache: e.target.checked })} />
                  <span>Sin caché</span>
                </label>
              )}
              <button className="icon-btn" onClick={() => setPrefs({ specs: specs.filter((_, j) => j !== i) })} aria-label={`Quitar ${specLabel(s)}`}>
                <Close width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-link" onClick={addSpec}>
          <Plus width={14} height={14} /> Añadir contendiente
        </button>
        <p className="field-hint">Usa el host y la key de Configuración de cada proveedor. Para comparar modelos del mismo host, añádelo varias veces con otro modelo.</p>
      </section>

      <section>
        <h3 className="section-label">Pregones</h3>
        <ul className="scenario-list">
          {town.content.examples.map((e) => (
            <li key={e.id}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={scenarioIds.includes(e.id)}
                  onChange={(ev) => setPrefs({ scenarioIds: ev.target.checked ? [...scenarioIds, e.id] : scenarioIds.filter((id) => id !== e.id) })}
                />
                <span>
                  <span className={`tone tone-${e.tone}`}>{e.tone}</span> {e.text}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="bench-knobs">
        <div className="field">
          <span className="field-label">Repeticiones</span>
          <div className="segmented reps" role="radiogroup" aria-label="Repeticiones" style={{ ['--active' as string]: repetitions - 1 }}>
            <span className="segmented-thumb" />
            {Array.from({ length: MAX_REPETITIONS }, (_, i) => i + 1).map((n) => (
              <button key={n} role="radio" aria-checked={repetitions === n} className={repetitions === n ? 'is-active' : ''} onClick={() => setPrefs({ repetitions: n })}>
                {n}
              </button>
            ))}
          </div>
          <span className="field-hint">Con 2 o más se mide la consistencia: si el mismo residente decide lo mismo cada vez.</span>
        </div>
        <label className="field">
          <span className="field-label">Semilla</span>
          <input className="input mono" type="number" value={seed} onChange={(e) => setPrefs({ seed: Math.trunc(Number(e.target.value)) || 0 })} />
          <span className="field-hint">Misma semilla, mismo pueblo y mismos prompts: así se comparan corridas de días distintos.</span>
        </label>
      </section>

      {keyless.length > 0 && (
        <div className="notice">
          <Alert width={16} height={16} />
          <p>
            {vaultLocked ? 'Tus keys cifradas siguen bloqueadas en esta pestaña' : 'No hay key en esta pestaña'} para {keyless.join(', ')}.{' '}
            {vaultLocked ? 'Desbloquéalas en Configuración' : 'Ponla en Configuración'} si el host la pide; si no, las peticiones fallarán con 401.{' '}
            <button className="btn-link" onClick={() => useTown.getState().setSettingsOpen(true)}>
              Abrir Configuración
            </button>
          </p>
        </div>
      )}

      <footer className="bench-start">
        <p>
          <b className="mono">{perModel}</b> peticiones por modelo{llmCount > 1 && <>, <b className="mono">{perModel * llmCount}</b> en total</>}. Solo se mide la primera reacción, sin boca en boca.
          {specs.some((s) => PAID.includes(s.kind)) && <span className="is-warning"> Con tu API key esto cuesta dinero real.</span>}
        </p>
        {costs.length > 0 && (
          <p className="bench-estimate" title={`Con ~${Math.round(avgPrompt)} tokens de prompt y ~${TYPICAL_REPLY_TOKENS} de respuesta por decisión, al precio de cada modelo.`}>
            Costo estimado: <b className="mono">{usd(priced.reduce((n, c) => n + c.cost!, 0), true)}</b>
            {priced.length > 1 && ` (${priced.map((c) => `${c.label} ${usd(c.cost, true)}`).join(' · ')})`}
            {unpriced.length > 0 && <span className="is-muted"> · sin precio: {unpriced.map((c) => c.label).join(', ')}</span>}
          </p>
        )}
        {problem && <p className="field-error">{problem}</p>}
        <div className="bench-start-actions">
          <button
            className="btn-secondary"
            disabled={!!problem}
            onClick={() => void start(true)}
            title={`Solo las ${GOLDEN_SIZE} decisiones con una respuesta clara, una vez cada una${priced.length ? `: ≈ ${usd((priced.reduce((n, c) => n + c.cost!, 0) * GOLDEN_SIZE) / Math.max(1, perModel))}` : ''}`}
          >
            Prueba rápida · {GOLDEN_SIZE} casos de oro
          </button>
          <button className="btn-primary" disabled={!!problem} onClick={() => void start()}>
            Correr prueba
          </button>
        </div>
      </footer>
    </div>
  )
}

function Progress() {
  const running = useBench((s) => s.running)!
  const specs = useBench((s) => s.specs)
  const cancel = useBench((s) => s.cancel)
  return (
    <div className="bench-progress" aria-live="polite">
      {Object.values(running.progress).map((p) => {
        const label = specs.find((s) => specId(s) === p.contender) ? specLabel(specs.find((s) => specId(s) === p.contender)!) : p.contender
        const state = p.done === p.total ? 'Listo' : p.done ? 'Corriendo' : 'En espera'
        return (
          <div key={p.contender} className="bench-progress-row">
            <div className="progress-head">
              <span>{label}</span>
              <span className="mono">
                {p.done}/{p.total}
                {p.errors ? ` · ${p.errors} errores` : ''} · {state}
              </span>
            </div>
            <div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={p.done} aria-valuemax={p.total}>
              <span className="bar-seg" style={{ width: `${(p.done / p.total) * 100}%` }} />
            </div>
            {running.lastError[p.contender] && <p className="field-error">Último error: {running.lastError[p.contender]}</p>}
          </div>
        )
      })}
      <p className="field-hint">Los contendientes corren uno tras otro para no competir por el mismo host. Puedes cerrar esta ventana; la prueba sigue.</p>
      <button className="btn-secondary" onClick={cancel}>
        Cancelar prueba
      </button>
    </div>
  )
}

function Result({ run }: { run: BenchRun }) {
  const label = (id: string) => run.contenders.find((c) => c.id === id)?.label ?? id
  const reports = run.report.contenders
  const name = `bench-${run.world}-${stamp()}`
  const hasRef = reports.some((r) => r.referenceAgreement !== null && r.contender !== 'rules')
  const best = bestOf(reports)
  const hasGolden = reports.some((r) => r.golden)
  const hasCache = reports.some((r) => r.metrics.cacheReadTokens || r.metrics.cacheWriteTokens)
  return (
    <div className="bench-result">
      <p className="bench-meta">
        {new Date(run.createdAt).toLocaleString('es')} · semilla <span className="mono">{run.seed}</span> · {run.repetitions} {run.repetitions === 1 ? 'repetición' : 'repeticiones'} · {seconds(run.durationMs)}
        {run.cancelled && <span className="badge">Cancelada</span>}
        {run.quick && <span className="badge">Prueba rápida</span>}
      </p>

      <div className="table-scroll">
        <table className="bench-table">
          <caption className="sr-only">Resultados por contendiente; el mejor modelo de cada columna va resaltado.</caption>
          <thead>
            <tr>
              <th scope="col">Contendiente</th>
              <th scope="col" title="Respuestas con el JSON pedido, sin arreglos">Formato</th>
              <th scope="col" title="Cuántas repeticiones coinciden con la acción más común del residente">Consistencia</th>
              <th scope="col" title="Creencias que coinciden con lo que de verdad pasó: le creyó a lo cierto y dudó de lo falso">Acierto</th>
              {hasGolden && <th scope="col" title="Decisiones con una respuesta clara (creer lo cierto y actuar como el personaje) que acertó">Oro</th>}
              <th scope="col" title="Decisiones que no contradicen la personalidad del residente (miedosos que no van al peligro, escépticos que no se tragan lo sospechoso…)">Personaje</th>
              {hasRef && <th scope="col" title="Acción más común igual a la de las reglas locales; una referencia, no la verdad">Como las reglas</th>}
              <th scope="col">Errores</th>
              <th scope="col" title="Mediana de lo que tarda en llegar el primer carácter del razonamiento">1.ª palabra</th>
              <th scope="col" title="Mediana y percentil 95 de la respuesta completa">Respuesta</th>
              <th scope="col" title="Peticiones terminadas por segundo, contando la espera">Pet/s</th>
              <th scope="col">Tokens/s</th>
              <th scope="col" title="Entrada → salida, en toda la corrida">Tokens</th>
              <th scope="col" title="Tokens de entrada y salida por decisión">Tok./dec.</th>
              {hasCache && <th scope="col" title="Parte del prompt que salió de la caché de Anthropic y lo que ahorró frente a pagarlo entero">Caché</th>}
              <th scope="col" title="≈ cuando se estimó con el precio de lista o el que escribiste; «sin precio» cuando no hay con qué estimar">Costo</th>
              <th scope="col" title="Lo que costarían 1.000 decisiones a este ritmo">$/1k dec.</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <Row key={r.contender} r={r} label={label(r.contender)} hasRef={hasRef} hasGolden={hasGolden} hasCache={hasCache} ms={run.durations?.[r.contender]} best={best} />
            ))}
          </tbody>
        </table>
      </div>

      {run.golden && <GoldenCases run={run} label={label} />}
      <JudgePanel run={run} label={label} />
      <Errors run={run} label={label} />
      <OutOfCharacter reports={reports} label={label} />

      {Object.keys(run.report.agreement).length > 0 && (
        <section>
          <h3 className="section-label">Acuerdo entre contendientes</h3>
          <ul className="agreement">
            {Object.entries(run.report.agreement).map(([pair, v]) => {
              const [a, b] = pair.split('|')
              return (
                <li key={pair}>
                  <span>
                    {label(a)} <span className="muted">y</span> {label(b)}
                  </span>
                  <span className="agreement-bar" style={{ ['--v' as string]: v }} />
                  <b className="mono">{pct(v)}</b>
                </li>
              )
            })}
          </ul>
          <p className="field-hint">Residentes en los que la acción más común coincide.</p>
        </section>
      )}

      <section>
        <h3 className="section-label">Qué decidieron, por pregón</h3>
        {run.scenarios.map((s) => (
          <div key={s.id} className="scenario-result">
            <p>
              <span className={`tone tone-${s.tone}`}>{s.tone}</span>
              {s.truth !== undefined && <span className={`truth-chip ${s.truth ? 'is-true' : 'is-false'}`}>{s.truth ? 'era verdad' : 'era mentira'}</span>} {s.text}
            </p>
            {reports.map((r) => {
              const d = r.byScenario[s.id]
              return (
                <div key={r.contender} className="dist-row">
                  <span className="dist-label">{label(r.contender)}</span>
                  <span className="dist-bar" aria-label={d ? ACTIONS.map((a) => `${ACTION_META[a].short}: ${d.actions[a]}`).join(', ') : 'Sin decisiones'}>
                    {d && ACTIONS.map((a) => (d.actions[a] ? <span key={a} style={{ flex: d.actions[a], background: ACTION_META[a].css }} title={`${ACTION_META[a].label}: ${d.actions[a]}`} /> : null))}
                  </span>
                  <span className="mono dist-belief" title="Le creyeron">
                    {d ? pct(d.believed / d.decided) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
        <ul className="legend">
          {ACTIONS.map((a) => (
            <li key={a}>
              <span className="action-dot" style={{ background: ACTION_META[a].css }} />
              {ACTION_META[a].short}
            </li>
          ))}
          <li className="muted">% = le creyeron</li>
        </ul>
      </section>

      {reports.some((r) => Object.keys(r.format.issues).length) && (
        <section>
          <h3 className="section-label">Problemas de formato</h3>
          <ul className="issues">
            {reports
              .filter((r) => Object.keys(r.format.issues).length)
              .map((r) => (
                <li key={r.contender}>
                  <b>{label(r.contender)}:</b>{' '}
                  {Object.entries(r.format.issues)
                    .sort((a, b) => b[1] - a[1])
                    .map(([issue, n]) => `${issue} (${n})`)
                    .join(', ')}
                </li>
              ))}
          </ul>
        </section>
      )}

      <div className="export-row">
        <span className="section-label">Exportar</span>
        <button className="btn-secondary compact" onClick={() => download(`${name}.json`, JSON.stringify(run, null, 2), 'application/json')}>
          <Download width={14} height={14} /> JSON
        </button>
        <button className="btn-secondary compact" onClick={() => download(`${name}.csv`, trialsCsv(run), 'text/csv')}>
          <Download width={14} height={14} /> CSV
        </button>
      </div>
    </div>
  )
}

type Best = Partial<Record<keyof typeof BEST, Set<string>>>

/** How each column is read and which way is better; the best model in each gets highlighted. */
const BEST = {
  format: [(r: ContenderReport) => (r.format.checked ? r.format.ok / r.format.checked : null), 'max'],
  consistency: [(r: ContenderReport) => r.consistency, 'max'],
  truth: [(r: ContenderReport) => r.truth ?? null, 'max'],
  golden: [(r: ContenderReport) => r.golden?.rate ?? null, 'max'],
  persona: [(r: ContenderReport) => r.persona ?? null, 'max'],
  ttft: [(r: ContenderReport) => r.metrics.ttft?.p50 ?? null, 'min'],
  total: [(r: ContenderReport) => r.metrics.total?.p50 ?? null, 'min'],
  per1k: [(r: ContenderReport) => per1k(r), 'min'],
} as const

const per1k = (r: ContenderReport) => {
  const decided = r.trials - r.errors
  return r.metrics.costUsd === null || !decided ? null : (r.metrics.costUsd / decided) * 1000
}

/** The contenders that win each column, among the models; none when they all tie. */
function bestOf(reports: ContenderReport[]): Best {
  const models = reports.filter((r) => r.contender !== 'rules')
  if (models.length < 2) return {}
  const out: Best = {}
  for (const [key, [read, dir]] of Object.entries(BEST) as [keyof typeof BEST, (typeof BEST)[keyof typeof BEST]][]) {
    const scored = models.map((r) => [r.contender, read(r)] as const).filter((x): x is readonly [string, number] => x[1] !== null)
    if (scored.length < 2) continue
    const values = scored.map(([, v]) => v)
    const top = dir === 'max' ? Math.max(...values) : Math.min(...values)
    if (values.every((v) => v === top)) continue
    out[key] = new Set(scored.filter(([, v]) => v === top).map(([id]) => id))
  }
  return out
}

function Row({ r, label, hasRef, hasGolden, hasCache, ms, best }: { r: ContenderReport; label: string; hasRef: boolean; hasGolden: boolean; hasCache: boolean; ms?: number; best: Best }) {
  const m = r.metrics
  const decided = r.trials - r.errors
  const top = (key: keyof typeof BEST) => (best[key]?.has(r.contender) ? 'is-best' : '')
  const rules = r.contender === 'rules'
  const cost = per1k(r)
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className={`mono ${top('format')}`}>{r.format.checked ? pct(r.format.ok / r.format.checked) : '—'}</td>
      <td className={`mono ${top('consistency')}`}>{pct(r.consistency)}</td>
      <td className={`mono ${top('truth')}`} title={r.truth != null ? `Se tragó ${r.fooled ?? 0} mentiras · dudó de ${r.doubted ?? 0} verdades` : undefined}>
        {pct(r.truth ?? null)}
      </td>
      {hasGolden && (
        <td className={`mono ${top('golden')}`} title={r.golden ? `${r.golden.passed} de ${r.golden.total}` : undefined}>
          {pct(r.golden?.rate ?? null)}
        </td>
      )}
      <td className={`mono ${top('persona')}`}>{pct(r.persona ?? null)}</td>
      {hasRef && <td className="mono">{r.contender === 'rules' ? '—' : pct(r.referenceAgreement)}</td>}
      <td className={`mono ${r.errors ? 'is-bad' : ''}`}>{r.errors ? `${r.errors}/${r.trials}` : '0'}</td>
      <td className={`mono ${top('ttft')}`}>{m.ttft && !rules ? seconds(m.ttft.p50) : '—'}</td>
      <td className={`mono ${top('total')}`}>{m.total && !rules ? `${seconds(m.total.p50)} · p95 ${seconds(m.total.p95)}` : '—'}</td>
      <td className="mono">{ms && r.contender !== 'rules' && decided ? (r.trials / (ms / 1000)).toFixed(1) : '—'}</td>
      <td className="mono">{m.tokensPerSecond ? m.tokensPerSecond.toFixed(0) : '—'}</td>
      <td className="mono">{m.inputTokens ? `${tokens(m.inputTokens)} → ${tokens(m.outputTokens)}` : '—'}</td>
      <td className="mono">{m.inputTokens && decided ? `${tokens(m.inputTokens / decided)} → ${tokens(m.outputTokens / decided)}` : '—'}</td>
      {hasCache && <td className="mono">{cacheText(m)}</td>}
      <td className={`mono ${m.costUsd === null && !rules ? 'is-muted' : ''}`}>{rules ? '—' : usd(m.costUsd, m.costEstimated)}</td>
      <td className={`mono ${top('per1k')}`}>{rules || cost === null ? '—' : usd(cost, m.costEstimated)}</td>
    </tr>
  )
}

function History() {
  const runs = useBench((s) => s.runs)
  const show = useBench((s) => s.show)
  const remove = useBench((s) => s.remove)
  const importRuns = useBench((s) => s.importRuns)
  const exportAll = useBench((s) => s.exportAll)
  const picker = (
    <label className="btn-secondary compact import-btn">
      Importar
      <input
        type="file"
        accept="application/json,.json"
        multiple
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length) void importRuns(files)
          e.target.value = ''
        }}
      />
    </label>
  )
  if (!runs.length)
    return (
      <div className="history-empty">
        <SharedFolder />
        <p className="empty-note">Aún no hay pruebas guardadas. Se guardan en este navegador y, si enlazas una carpeta, también ahí. Puedes importar las de «npm run bench» o un lote exportado de otra máquina.</p>
        {picker}
      </div>
    )
  return (
    <div className="history-wrap">
      <SharedFolder />
      <div className="history-actions">
        {picker}
        <button className="btn-secondary compact" onClick={exportAll} title="Todas las pruebas en un solo archivo, para otra máquina">
          Exportar todo ({runs.length})
        </button>
      </div>
      <ul className="history">
      {runs.map((run) => (
        <li key={run.id}>
          <button className="history-open" onClick={() => show(run)}>
            <span className="history-date">
              {new Date(run.createdAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}
              {run.cancelled && <span className="badge">Cancelada</span>}
            </span>
            <span className="history-sub">
              {run.contenders.map((c) => c.label).join(' vs ')} · {run.scenarios.length} pregones × {run.repetitions}
            </span>
            <span className="history-sub">{runDigest(run)}</span>
          </button>
          <button className="btn-link small" onClick={() => void remove(run.id)} aria-label="Borrar esta prueba">
            Borrar
          </button>
        </li>
      ))}
      </ul>
    </div>
  )
}

const ACTION_SHORT: Record<string, string> = { go: 'ir', stay_home: 'casa', warn: 'avisar', investigate: 'investigar', ignore: 'ignorar' }

/** Each golden decision, what was right, and how every contender did on it. */
function GoldenCases({ run, label }: { run: BenchRun; label: (id: string) => string }) {
  const contenders = run.contenders.map((c) => c.id)
  const scenario = (id: string) => run.scenarios.find((s) => s.id === id)?.text ?? id
  return (
    <details className="golden">
      <summary className="section-label">Casos de oro · {run.golden!.length} decisiones con una respuesta clara</summary>
      <p className="field-hint">Se eligen solos: la verdad del pregón, las reglas de personaje y el modo simulado coinciden, y pocas acciones encajan con el vecino. Acierta quien cree lo cierto y elige una de esas acciones. Las reglas locales aciertan todos por construcción: sirven de referencia, no compiten.</p>
      <div className="table-scroll">
        <table className="bench-table golden-table">
          <thead>
            <tr>
              <th scope="col">Vecino y pregón</th>
              <th scope="col">Lo correcto</th>
              {contenders.map((c) => (
                <th key={c} scope="col">
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {run.golden!.map((g) => (
              <tr key={`${g.scenario}-${g.resident}`}>
                <th scope="row">
                  {shortName(g.resident)}
                  <span className="golden-sub">«{scenario(g.scenario).slice(0, 30)}…»</span>
                </th>
                <td>
                  {g.believes ? 'creer' : 'no creer'} · {g.actions.map((a) => ACTION_SHORT[a]).join(', ')}
                </td>
                {contenders.map((c) => {
                  const mine = run.trials.filter((t) => t.contender === c && t.scenario === g.scenario && t.resident === g.resident)
                  const ok = mine.filter((t) => passesGolden(g, t)).length
                  return (
                    <td key={c} className={`mono ${mine.length && ok === mine.length ? 'is-best' : mine.length && !ok ? 'is-bad' : ''}`}>
                      {mine.length ? (mine.length === 1 ? (ok ? '✓' : '✗') : `${ok}/${mine.length}`) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Where the runs are shared with other machines: a folder in Chrome and Edge, files everywhere else. */
function SharedFolder() {
  const { folder, linkFolder, reconnectFolder, unlinkFolder } = useBench()
  if (!foldersSupported())
    return <p className="field-hint shared-folder">Para compartir entre máquinas usa «Exportar todo» e «Importar». Con Chrome o Edge puedes enlazar además una carpeta sincronizada.</p>
  if (!folder)
    return (
      <div className="shared-folder">
        <span>Enlaza una carpeta sincronizada (iCloud, Dropbox, Drive) y cada prueba se guardará ahí; otra máquina que apunte a la misma carpeta las verá. «npm run bench» puede guardar ahí también.</span>
        <button className="btn-secondary compact" onClick={() => void linkFolder()}>
          Enlazar carpeta
        </button>
      </div>
    )
  return (
    <div className="shared-folder is-linked">
      <span>
        📁 Carpeta compartida: <b>{folder.name}</b>
        {folder.access === 'granted' ? '' : ' · el navegador pide permiso de nuevo'}
      </span>
      {folder.access !== 'granted' && (
        <button className="btn-secondary compact" onClick={() => void reconnectFolder()}>
          Dar permiso
        </button>
      )}
      <button className="btn-link small" onClick={() => void unlinkFolder()}>
        Desenlazar
      </button>
    </div>
  )
}

/** One line to tell runs apart: who got it most right, what it cost, and whether anything failed. */
function runDigest(run: BenchRun) {
  const models = run.report.contenders.filter((r) => r.contender !== 'rules')
  const label = (id: string) => run.contenders.find((c) => c.id === id)?.label ?? id
  const top = models.filter((r) => r.truth != null).sort((a, b) => b.truth! - a.truth!)[0]
  const costs = models.map((r) => r.metrics.costUsd).filter((c): c is number => c !== null)
  const errors = run.report.contenders.reduce((n, r) => n + r.errors, 0)
  return [
    run.quick ? 'prueba rápida' : '',
    top ? `más acierto: ${label(top.contender)} (${pct(top.truth!)})` : '',
    costs.length ? `costó ${usd(costs.reduce((a, b) => a + b, 0), models.some((r) => r.metrics.costEstimated))}` : '',
    errors ? `${errors} errores` : 'sin errores',
  ]
    .filter(Boolean)
    .join(' · ')
}

function Errors({ run, label }: { run: BenchRun; label: (id: string) => string }) {
  const summary = errorSummary(run.trials)
  if (!summary.size) return null
  return (
    <section className="failure-banner bench-errors" role="alert">
      <Alert width={16} height={16} />
      <div>
        {[...summary].map(([id, list]) => (
          <div key={id}>
            <p>
              <b>{label(id)}</b>
              {run.stopped?.includes(id) && ` se detuvo: sus primeras ${FAIL_FAST_AFTER} peticiones fallaron.`}
            </p>
            <ul>
              {list.map(([message, n]) => (
                <li key={message}>
                  <span className="mono">{n}×</span> {message}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

const shortName = (id: string) => nameOf(town.content, id)

function OutOfCharacter({ reports, label }: { reports: ContenderReport[]; label: (id: string) => string }) {
  const broken = reports.filter((r) => r.personaBroken && Object.keys(r.personaBroken).length)
  if (!broken.length) return null
  return (
    <section>
      <h3 className="section-label">Fuera de personaje</h3>
      <ul className="issues">
        {broken.map((r) => (
          <li key={r.contender}>
            <b>{label(r.contender)}</b>
            <ul className="persona-list">
              {Object.entries(r.personaBroken!)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([rule, e]) => (
                  <li key={rule}>
                    <span className="mono">{e.count}×</span> {RULE_LABEL[rule] ?? rule}: {e.residents.map(shortName).join(', ')}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="field-hint">Solo cuenta contradicciones claras con las escalas de personalidad; no hay una única respuesta correcta.</p>
    </section>
  )
}
