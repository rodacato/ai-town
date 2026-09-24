import { useState } from 'react'
import { JUDGE_SYSTEM, judgePrompt, pickCases, summarizeJudgments } from '../../../core/bench/judge'
import type { BenchRun } from '../../../core/bench/run'
import { usd } from '../../../core/format'
import { nameOf } from '../../../core/lang'
import { missingKey, PRESETS, type Connection } from '../../../providers/llm/config'
import { estimateCost, priceInfo, roughTokens } from '../../../providers/llm/pricing'
import { Choice } from '../../shared/Choice'
import { useTown } from '../../store'
import { town } from '../../town'
import { useBench } from './benchStore'

const KINDS: Connection['kind'][] = ['anthropic', 'openai', 'shellm', 'custom']
const SAMPLES = [6, 12, 24]
/** A verdict is one short JSON line. */
const JUDGE_REPLY_TOKENS = 80

/** A second model reads a sample of decisions and says how much each sounds like its resident, from 1 to 5. */
export function JudgePanel({ run, label }: { run: BenchRun; label: (id: string) => string }) {
  const judging = useBench((s) => s.judging)
  const models = run.contenders.filter((c) => c.kind !== 'rules')
  if (!models.length) return null
  return (
    <section className="judge">
      <h3 className="section-label">Juez de personaje</h3>
      {judging ? <Progress /> : run.judge ? <Verdict run={run} label={label} /> : null}
      {!judging && <Ask run={run} again={!!run.judge} />}
    </section>
  )
}

function Progress() {
  const { judging, cancelJudge } = useBench()
  if (!judging) return null
  return (
    <div className="judge-progress" aria-live="polite">
      <span>
        El juez va en <b className="mono">{judging.done}</b> de <b className="mono">{judging.total || '…'}</b> decisiones
      </span>
      <span className="duel-bar">
        <span style={{ width: `${judging.total ? (judging.done / judging.total) * 100 : 0}%` }} />
      </span>
      <button className="btn-secondary compact" onClick={cancelJudge}>
        Cancelar
      </button>
    </div>
  )
}

function Verdict({ run, label }: { run: BenchRun; label: (id: string) => string }) {
  const j = run.judge!
  const summary = summarizeJudgments(
    j,
    run.contenders.filter((c) => c.kind !== 'rules').map((c) => c.id),
  )
  const scenario = (id: string) => run.scenarios.find((s) => s.id === id)?.text ?? id
  return (
    <>
      <p className="field-hint">
        Juzgó <b>{j.judge}</b> · {j.perContender} decisiones por contendiente · {usd(j.costUsd, j.costEstimated)}. Mide si la decisión y las palabras suenan a ese vecino, no si acertó.
      </p>
      <table className="bench-table judge-table">
        <thead>
          <tr>
            <th scope="col">Contendiente</th>
            <th scope="col" title="Media de 1 (lo contradice) a 5 (es exactamente él)">Personaje según el juez</th>
            <th scope="col">Juzgadas</th>
            <th scope="col">Sin respuesta</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.contender}>
              <th scope="row">{label(s.contender)}</th>
              <td className="mono">
                {s.mean === null ? '—' : (
                  <span className="judge-score">
                    <span className="judge-bar" aria-hidden>
                      <span style={{ width: `${((s.mean - 1) / 4) * 100}%` }} />
                    </span>
                    {s.mean.toFixed(1)} / 5
                  </span>
                )}
              </td>
              <td className="mono">{s.judged}</td>
              <td className={`mono ${s.failed ? 'is-bad' : ''}`}>{s.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {summary.some((s) => s.worst.length) && (
        <details>
          <summary>Lo menos creíble de cada contendiente</summary>
          <ul className="judge-worst">
            {summary.flatMap((s) =>
              s.worst.map((w) => (
                <li key={`${s.contender}-${w.scenario}-${w.resident}-${w.rep}`}>
                  <span className="mono">{w.score}/5</span>
                  <span>
                    <b>{nameOf(town.content, w.resident)}</b> con {label(s.contender)}, ante «{scenario(w.scenario).slice(0, 60)}…»: {w.reason}
                  </span>
                </li>
              )),
            )}
          </ul>
        </details>
      )}
    </>
  )
}

function Ask({ run, again }: { run: BenchRun; again: boolean }) {
  const llm = useTown((s) => s.llm)
  const envKeys = useTown((s) => s.envKeys)
  const judge = useBench((s) => s.judge)
  const firstKind = llm.active === 'mock' ? 'anthropic' : llm.active
  const [kind, setKind] = useState<Connection['kind']>(firstKind)
  const [model, setModel] = useState(llm.connections[firstKind].model)
  const [per, setPer] = useState(12)
  const cases = pickCases(run, per)
  const connection = { ...llm.connections[kind], model: model.trim() }
  const tokensIn = cases.length ? roughTokens(JUDGE_SYSTEM) + roughTokens(judgePrompt(town.content, run, cases[0])) : 0
  const info = priceInfo(connection)
  const cost = info ? (estimateCost(info.price, tokensIn * cases.length, JUDGE_REPLY_TOKENS * cases.length) ?? null) : null
  const keyless = missingKey({ ...llm, active: kind }, envKeys)
  const problem = !cases.length ? 'Esta prueba no guardó razonamientos: vuelve a correrla para poder juzgarla.' : !model.trim() ? 'Falta el modelo del juez.' : keyless ? `Falta la key de ${PRESETS[kind].label}.` : null
  return (
    <div className="judge-ask">
      <div className="judge-row">
        <select
          className="input"
          value={kind}
          onChange={(e) => {
            const k = e.target.value as Connection['kind']
            setKind(k)
            setModel(llm.connections[k].model)
          }}
          aria-label="Proveedor del juez"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {PRESETS[k].label}
            </option>
          ))}
        </select>
        <input className="input mono" value={model} placeholder={PRESETS[kind].modelHint} onChange={(e) => setModel(e.target.value)} aria-label="Modelo del juez" />
        <Choice label="Decisiones por contendiente" options={SAMPLES} value={per} onPick={setPer} render={(n) => `${n}`} />
      </div>
      <p className="field-hint">
        {cases.length} decisiones, siempre las mismas para esta prueba · {usd(cost, true)}. Conviene un juez distinto de los contendientes.
      </p>
      {problem && <p className="field-error">{problem}</p>}
      <button className="btn-secondary compact" disabled={!!problem} onClick={() => void judge({ kind, model }, per)}>
        {again ? 'Volver a juzgar' : 'Juzgar el personaje'}
      </button>
    </div>
  )
}
