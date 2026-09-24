import type { Action } from '../decisions/types'
import type { ContenderReport } from './analysis'
import { modalActions } from './analysis'
import type { BenchRun } from './run'

/** One contender inside one run: the unit compared, so it covers "same model on two days" and "two models in one run". */
export interface Side {
  run: BenchRun
  contender: string
}

export interface MetricDelta {
  id: string
  label: string
  base: number | null
  next: number | null
  /** 'better' / 'worse' when both sides have a value and it moved past the noise; 'same' otherwise. */
  verdict: 'better' | 'worse' | 'same' | 'n/a'
  unit: 'pct' | 'ms' | 'rate' | 'usd' | 'count'
}

export interface DecisionChange {
  scenario: string
  resident: string
  base: Action
  next: Action
}

export interface Comparison {
  metrics: MetricDelta[]
  changes: DecisionChange[]
  /** Residents decided on both sides, so changes read as "n of total". */
  compared: number
  /** Why the prompts may not have been identical, if they were not. */
  caveats: string[]
}

interface MetricDef {
  id: string
  label: string
  unit: MetricDelta['unit']
  higherIsBetter: boolean
  /** Smallest change that counts, so jitter does not paint everything red or green. */
  noise: number
  read: (r: ContenderReport, run: BenchRun) => number | null
}

const METRICS: MetricDef[] = [
  { id: 'format', label: 'Formato', unit: 'pct', higherIsBetter: true, noise: 0.02, read: (r) => (r.format.checked ? r.format.ok / r.format.checked : null) },
  { id: 'consistency', label: 'Consistencia', unit: 'pct', higherIsBetter: true, noise: 0.03, read: (r) => r.consistency },
  { id: 'persona', label: 'Personaje', unit: 'pct', higherIsBetter: true, noise: 0.03, read: (r) => r.persona ?? null },
  { id: 'reference', label: 'Como las reglas', unit: 'pct', higherIsBetter: true, noise: 0.03, read: (r) => (r.contender === 'rules' ? null : r.referenceAgreement) },
  { id: 'errors', label: 'Errores', unit: 'pct', higherIsBetter: false, noise: 0.01, read: (r) => (r.trials ? r.errors / r.trials : null) },
  { id: 'p50', label: 'Respuesta p50', unit: 'ms', higherIsBetter: false, noise: 0.1, read: (r) => r.metrics.total?.p50 ?? null },
  { id: 'p95', label: 'Respuesta p95', unit: 'ms', higherIsBetter: false, noise: 0.1, read: (r) => r.metrics.total?.p95 ?? null },
  { id: 'ttft', label: 'Primera palabra p50', unit: 'ms', higherIsBetter: false, noise: 0.1, read: (r) => r.metrics.ttft?.p50 ?? null },
  {
    id: 'throughput',
    label: 'Peticiones/s',
    unit: 'rate',
    higherIsBetter: true,
    noise: 0.1,
    read: (r, run) => {
      const ms = run.durations?.[r.contender]
      return ms && r.errors < r.trials && r.contender !== 'rules' ? r.trials / (ms / 1000) : null
    },
  },
  { id: 'tps', label: 'Tokens/s', unit: 'rate', higherIsBetter: true, noise: 0.1, read: (r) => r.metrics.tokensPerSecond },
  { id: 'cost', label: 'Costo por decisión', unit: 'usd', higherIsBetter: false, noise: 0.05, read: (r) => (r.metrics.costUsd !== null && r.trials > r.errors ? r.metrics.costUsd / (r.trials - r.errors) : null) },
]

function verdict(def: MetricDef, base: number | null, next: number | null): MetricDelta['verdict'] {
  if (base === null || next === null) return 'n/a'
  // Percentages move in absolute points; times, rates and money relative to where they started.
  const change = def.unit === 'pct' ? next - base : base === 0 ? (next === 0 ? 0 : Infinity) : (next - base) / Math.abs(base)
  if (Math.abs(change) < def.noise) return 'same'
  return change > 0 === def.higherIsBetter ? 'better' : 'worse'
}

const order = (run: BenchRun, scenario: string) => run.scenarios.findIndex((s) => s.id === scenario)

const reportOf = (s: Side) => {
  const r = s.run.report.contenders.find((c) => c.contender === s.contender)
  if (!r) throw new Error(`La prueba no tiene al contendiente «${s.contender}».`)
  return r
}

export function compareSides(base: Side, next: Side): Comparison {
  const a = reportOf(base)
  const b = reportOf(next)
  const metrics = METRICS.map((def) => {
    const x = def.read(a, base.run)
    const y = def.read(b, next.run)
    return { id: def.id, label: def.label, unit: def.unit, base: x, next: y, verdict: verdict(def, x, y) }
  })

  const modesA = modalActions(base.run.trials.filter((t) => t.contender === base.contender))
  const modesB = modalActions(next.run.trials.filter((t) => t.contender === next.contender))
  const shared = [...modesA.keys()].filter((k) => modesB.has(k))
  const changes = shared
    .filter((k) => modesA.get(k)!.action !== modesB.get(k)!.action)
    .map((k) => {
      const [scenario, resident] = k.split('/')
      return { scenario, resident, base: modesA.get(k)!.action, next: modesB.get(k)!.action }
    })
    .sort((x, y) => order(base.run, x.scenario) - order(base.run, y.scenario))

  const caveats: string[] = []
  if (base.run.world !== next.run.world) caveats.push('Son mundos distintos.')
  if (base.run.seed !== next.run.seed) caveats.push(`Semillas distintas (${base.run.seed} y ${next.run.seed}): el pueblo y los prompts no son idénticos.`)
  const scenariosA = base.run.scenarios.map((s) => s.id)
  const scenariosB = next.run.scenarios.map((s) => s.id)
  if (scenariosA.join() !== scenariosB.join()) caveats.push('No usan los mismos pregones; solo se comparan los que comparten.')
  if (base.run.repetitions !== next.run.repetitions) caveats.push(`Repeticiones distintas (${base.run.repetitions} y ${next.run.repetitions}): la consistencia no es comparable del todo.`)
  if (base.run.cancelled || next.run.cancelled) caveats.push('Alguna de las dos pruebas se canceló a medias.')

  return { metrics, changes, compared: shared.length, caveats }
}
