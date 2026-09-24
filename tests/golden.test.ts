import { describe, expect, it } from 'vitest'
import { compareSides } from '../src/core/bench/compare'
import { GOLDEN_SIZE, goldenCases, goldenScore, passesGolden } from '../src/core/bench/golden'
import { executeRun } from '../src/core/bench/run'
import { buildScenario } from '../src/core/bench/scenarios'
import { createRulesProvider, mockDecision } from '../src/providers/mock'
import type { DecisionProvider } from '../src/core/decisions/types'
import { content } from './helpers'

const reference = (ctx: Parameters<typeof mockDecision>[0]) => mockDecision(ctx, content.vocabulary)
const scenarios = (seed: number) => content.examples.map((e) => buildScenario(content, e, seed))

/** Always goes and always believes: right only by chance. */
const reckless: DecisionProvider = {
  id: 'reckless',
  label: 'Temerario',
  async *decide() {
    yield { type: 'final', decision: { action: 'go', believes: true, tell: [], reasoning: 'Voy.', speech: '¡Voy!', emoji: '🏃', confidence: 1 } }
  },
}

describe('golden cases', () => {
  it('picks the same ten every time, spread over the announcements, each agreeing with the truth', () => {
    const cases = goldenCases(scenarios(7), reference)
    expect(cases).toHaveLength(GOLDEN_SIZE)
    expect(goldenCases(scenarios(7), reference)).toEqual(cases)
    expect(new Set(cases.map((c) => c.scenario)).size).toBe(content.examples.length)
    for (const c of cases) {
      expect(c.believes).toBe(content.examples.find((e) => e.id === c.scenario)!.truth)
      expect(c.actions.length).toBeLessThan(5)
    }
  })

  it('passes only the right belief with one of the right actions', () => {
    const c = { scenario: 's', resident: 'r', believes: false, actions: ['stay_home' as const, 'ignore' as const] }
    expect(passesGolden(c, { believes: false, action: 'ignore' })).toBe(true)
    expect(passesGolden(c, { believes: true, action: 'ignore' })).toBe(false)
    expect(passesGolden(c, { believes: false, action: 'go' })).toBe(false)
    expect(passesGolden(c, { believes: false, action: null })).toBe(false)
  })

  it('asks only the golden decisions in a quick run, and scores and compares them', async () => {
    const contender = (id: string, provider: DecisionProvider) => ({ contender: { id, label: id, provider, concurrency: 8, timeoutMs: 5000 }, info: { id, label: id, kind: id === 'rules' ? 'rules' : 'custom', model: id, host: '', concurrency: 8 } })
    const quick = await executeRun({ content, examples: content.examples, seed: 7, repetitions: 1, contenders: [contender('rules', createRulesProvider(content.vocabulary)), contender('reckless', reckless)], reference, quick: true })
    expect(quick.quick).toBe(true)
    expect(quick.trials.filter((t) => t.contender === 'reckless')).toHaveLength(GOLDEN_SIZE)
    const rules = quick.report.contenders.find((c) => c.contender === 'rules')!.golden!
    const wild = quick.report.contenders.find((c) => c.contender === 'reckless')!.golden!
    expect(rules.rate).toBe(1)
    expect(wild.rate).toBeLessThan(1)
    expect(goldenScore(quick.golden!, quick.trials, 'reckless')).toEqual(wild)
    const golden = compareSides({ run: quick, contender: 'rules' }, { run: quick, contender: 'reckless' }).metrics.find((m) => m.id === 'golden')!
    expect(golden.verdict).toBe('worse')
  })
})
