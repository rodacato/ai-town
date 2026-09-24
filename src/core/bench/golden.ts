import { ACTIONS, type Action, type Decision, type DecisionContext } from '../decisions/types'
import { checkCoherence } from './coherence'
import type { Trial } from './runner'
import type { Scenario } from './scenarios'

/** A decision with only one right answer: what to believe, and the few actions that fit this resident. */
export interface GoldenCase {
  scenario: string
  resident: string
  believes: boolean
  actions: Action[]
}

export const GOLDEN_SIZE = 10
/** A case only counts when its right actions are this few; more would make it easy to pass. */
const MAX_ACTIONS = 4

/** Chosen without curation: where the truth, the personality rules and the rules mode all agree, and few actions fit. */
export function goldenCases(scenarios: Scenario[], reference: (ctx: DecisionContext) => Decision, size = GOLDEN_SIZE): GoldenCase[] {
  const candidates = scenarios.flatMap((s) => {
    if (s.truth === undefined) return []
    return s.contexts.flatMap((ctx) => {
      const ref = reference(ctx)
      if (ref.believes !== s.truth) return []
      const verdict = (action: Action) => checkCoherence(ctx, s.tone, { ...ref, action, believes: s.truth! })
      if (!verdict(ref.action).checked) return []
      const actions = ACTIONS.filter((a) => verdict(a).broken.length === 0)
      if (!actions.includes(ref.action) || actions.length > MAX_ACTIONS) return []
      return [{ scenario: s.id, resident: ctx.resident.id, believes: s.truth, actions, rules: verdict(ref.action).checked }]
    })
  })
  // Narrowest and most rule-bound first, taking turns between announcements so none dominates.
  const byScenario = scenarios.map((s) =>
    candidates.filter((c) => c.scenario === s.id).sort((a, b) => a.actions.length - b.actions.length || b.rules - a.rules || a.resident.localeCompare(b.resident)),
  )
  const out: GoldenCase[] = []
  for (let i = 0; out.length < size && byScenario.some((list) => list.length > i); i++)
    for (const list of byScenario) if (list[i] && out.length < size) out.push({ scenario: list[i].scenario, resident: list[i].resident, believes: list[i].believes, actions: list[i].actions })
  return out
}

export const passesGolden = (c: GoldenCase, t: Pick<Trial, 'action' | 'believes'>) => t.believes === c.believes && !!t.action && c.actions.includes(t.action)

/** Share of golden decisions a contender got right, over every repetition; null when it faced none. */
export function goldenScore(cases: GoldenCase[], trials: Trial[], contender: string): { passed: number; total: number; rate: number } | null {
  const mine = trials.filter((t) => t.contender === contender)
  let passed = 0
  let total = 0
  for (const c of cases)
    for (const t of mine.filter((x) => x.scenario === c.scenario && x.resident === c.resident)) {
      total++
      if (passesGolden(c, t)) passed++
    }
  return total ? { passed, total, rate: passed / total } : null
}
