import { ACTIONS, type Action, type Decision } from '../decisions/types'
import { runMetrics, type RunMetrics } from '../reactions/metrics'
import type { FormatStatus } from './format'
import type { Trial } from './runner'

export interface ContenderReport {
  contender: string
  trials: number
  errors: number
  format: Record<FormatStatus, number> & { checked: number; issues: Record<string, number> }
  /** Mean share of repetitions that agree with the most common action, per resident and scenario. Null with one repetition. */
  consistency: number | null
  beliefConsistency: number | null
  /** Share of residents whose most common action matches the rule-based reference. */
  referenceAgreement: number | null
  /** Share of applicable personality rules the decisions kept; null when none applied. */
  persona?: number | null
  /** Broken personality rules by id, with the residents who broke them. */
  personaBroken?: Record<string, { count: number; residents: string[] }>
  /** Share of beliefs that matched what really happened; null when no scenario had a truth. */
  truth?: number | null
  /** Believed something false. */
  fooled?: number
  /** Doubted something true. */
  doubted?: number
  metrics: RunMetrics
  byScenario: Record<string, { actions: Record<Action, number>; believed: number; decided: number }>
}

export interface BenchReport {
  contenders: ContenderReport[]
  /** Share of residents where two contenders' most common action matches, keyed "a|b". */
  agreement: Record<string, number>
}

export type Reference = Map<string, Decision>

/** Distinct error messages per contender, most frequent first. */
export function errorSummary(trials: Trial[]) {
  const out = new Map<string, [message: string, count: number][]>()
  for (const t of trials) {
    if (!t.error) continue
    const list = out.get(t.contender) ?? []
    const hit = list.find(([m]) => m === t.error)
    if (hit) hit[1]++
    else list.push([t.error, 1])
    out.set(t.contender, list)
  }
  for (const list of out.values()) list.sort((a, b) => b[1] - a[1])
  return out
}

export const cellKey = (scenario: string, resident: string) => `${scenario}/${resident}`

function mode<T>(values: T[], order: readonly T[]): T {
  const counts = new Map<T, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return order.reduce((best, v) => ((counts.get(v) ?? 0) > (counts.get(best) ?? 0) ? v : best), order[0])
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** The most common action of each resident in each scenario, from successful trials only. */
export function modalActions(trials: Trial[]) {
  const cells = new Map<string, Trial[]>()
  for (const t of trials) if (t.action) cells.set(cellKey(t.scenario, t.resident), [...(cells.get(cellKey(t.scenario, t.resident)) ?? []), t])
  return new Map([...cells].map(([k, ts]) => [k, { action: mode(ts.map((t) => t.action!), ACTIONS), believes: mode(ts.map((t) => t.believes!), [true, false]), trials: ts }]))
}

export function analyze(trials: Trial[], contenders: string[], reference?: Reference): BenchReport {
  const modes = new Map(contenders.map((c) => [c, modalActions(trials.filter((t) => t.contender === c))]))
  const reports = contenders.map((c): ContenderReport => {
    const mine = trials.filter((t) => t.contender === c)
    const cells = [...modes.get(c)!.values()]
    const repeated = cells.filter((cell) => cell.trials.length > 1)
    const format = { ok: 0, repaired: 0, invalid: 0, checked: 0, issues: {} as Record<string, number> }
    for (const t of mine) {
      if (!t.format) continue
      format.checked++
      format[t.format.status]++
      for (const issue of t.format.issues) format.issues[issue] = (format.issues[issue] ?? 0) + 1
    }
    const byScenario: ContenderReport['byScenario'] = {}
    for (const t of mine) {
      if (!t.action) continue
      const s = (byScenario[t.scenario] ??= { actions: Object.fromEntries(ACTIONS.map((a) => [a, 0])) as Record<Action, number>, believed: 0, decided: 0 })
      s.actions[t.action]++
      s.decided++
      if (t.believes) s.believed++
    }
    let checked = 0
    const personaBroken: NonNullable<ContenderReport['personaBroken']> = {}
    for (const t of mine) {
      if (!t.persona) continue
      checked += t.persona.checked
      for (const id of t.persona.broken) {
        const entry = (personaBroken[id] ??= { count: 0, residents: [] })
        entry.count++
        if (!entry.residents.includes(t.resident)) entry.residents.push(t.resident)
      }
    }
    const brokenTotal = Object.values(personaBroken).reduce((n, e) => n + e.count, 0)
    const scored = mine.filter((t) => t.right !== undefined)
    const compared = reference ? [...modes.get(c)!].filter(([k]) => reference.has(k)) : []
    return {
      contender: c,
      trials: mine.length,
      errors: mine.filter((t) => t.error).length,
      format,
      consistency: mean(repeated.map((cell) => cell.trials.filter((t) => t.action === cell.action).length / cell.trials.length)),
      beliefConsistency: mean(repeated.map((cell) => cell.trials.filter((t) => t.believes === cell.believes).length / cell.trials.length)),
      persona: checked ? 1 - brokenTotal / checked : null,
      personaBroken,
      truth: scored.length ? scored.filter((t) => t.right).length / scored.length : null,
      fooled: scored.filter((t) => !t.right && t.believes).length,
      doubted: scored.filter((t) => !t.right && !t.believes).length,
      referenceAgreement: compared.length ? compared.filter(([k, cell]) => reference!.get(k)!.action === cell.action).length / compared.length : null,
      metrics: runMetrics(mine),
      byScenario,
    }
  })
  const agreement: Record<string, number> = {}
  for (const [i, a] of contenders.entries())
    for (const b of contenders.slice(i + 1)) {
      const ma = modes.get(a)!
      const mb = modes.get(b)!
      const shared = [...ma.keys()].filter((k) => mb.has(k))
      if (shared.length) agreement[`${a}|${b}`] = shared.filter((k) => ma.get(k)!.action === mb.get(k)!.action).length / shared.length
    }
  return { contenders: reports, agreement }
}
