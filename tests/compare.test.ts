import { describe, expect, it } from 'vitest'
import { compareSides } from '../src/core/bench/compare'
import { executeRun, type BenchRun } from '../src/core/bench/run'
import type { Contender } from '../src/core/bench/runner'
import type { DecisionEvent, DecisionProvider } from '../src/core/decisions/types'
import { createRulesProvider, mockDecision } from '../src/providers/mock'
import { content } from './helpers'

const info = (id: string) => ({ id, label: id, kind: id, model: '', host: '', concurrency: 8 })
const rules = (): Contender => ({ id: 'rules', label: 'rules', provider: createRulesProvider(content.vocabulary), concurrency: 8, timeoutMs: 5000 })

/** Everyone ignores everything: a model that changed its mind about the whole town. */
const apathetic: DecisionProvider = {
  id: 'apathetic',
  label: 'apathetic',
  async *decide(ctx): AsyncIterable<DecisionEvent> {
    yield { type: 'final', decision: { ...mockDecision(ctx, content.vocabulary), action: 'ignore', tell: [] } }
  },
}

const run = (seed: number, contenders: Contender[]) =>
  executeRun({ content, examples: content.examples.slice(0, 2), seed, repetitions: 1, contenders: contenders.map((c) => ({ contender: c, info: info(c.id) })) })

describe('comparing runs', () => {
  it('finds nothing to report between two identical runs of the same model', async () => {
    const [a, b] = [await run(7, [rules()]), await run(7, [rules()])]
    const cmp = compareSides({ run: a, contender: 'rules' }, { run: b, contender: 'rules' })
    expect(cmp.changes).toEqual([])
    expect(cmp.compared).toBe(a.trials.length)
    expect(cmp.caveats).toEqual([])
    expect(cmp.metrics.find((m) => m.id === 'persona')!.verdict).toBe('same')
  })

  it('lists every resident who changed their mind, and flags the drop in character', async () => {
    const both = await run(7, [rules(), { ...rules(), id: 'apathetic', provider: apathetic }])
    const cmp = compareSides({ run: both, contender: 'rules' }, { run: both, contender: 'apathetic' })
    expect(cmp.changes.length).toBeGreaterThan(0)
    expect(cmp.changes.every((c) => c.next === 'ignore' && c.base !== 'ignore')).toBe(true)
    expect(cmp.metrics.find((m) => m.id === 'persona')!.verdict).toBe('worse')
  })

  it('warns when the prompts cannot have been the same', async () => {
    const [a, b] = [await run(7, [rules()]), await run(8, [rules()])]
    expect(compareSides({ run: a, contender: 'rules' }, { run: b, contender: 'rules' }).caveats.join(' ')).toMatch(/Semillas distintas/)
  })

  it('reads latency and money as lower-is-better, ignoring jitter', async () => {
    const base = await run(7, [rules()])
    const tweak = (p50: number, cost: number): BenchRun => {
      const clone = structuredClone(base)
      const r = clone.report.contenders[0]
      r.metrics.total = { p50, p95: p50 * 2, max: p50 * 3 }
      r.metrics.costUsd = cost
      return clone
    }
    const cmp = compareSides({ run: tweak(1000, 1), contender: 'rules' }, { run: tweak(700, 1.02), contender: 'rules' })
    expect(cmp.metrics.find((m) => m.id === 'p50')!.verdict).toBe('better')
    expect(cmp.metrics.find((m) => m.id === 'cost')!.verdict).toBe('same')
    const worse = compareSides({ run: tweak(1000, 1), contender: 'rules' }, { run: tweak(1500, 2), contender: 'rules' })
    expect(worse.metrics.find((m) => m.id === 'p50')!.verdict).toBe('worse')
    expect(worse.metrics.find((m) => m.id === 'cost')!.verdict).toBe('worse')
  })

  it('refuses a contender the run does not have', async () => {
    const a = await run(7, [rules()])
    expect(() => compareSides({ run: a, contender: 'nadie' }, { run: a, contender: 'rules' })).toThrow('nadie')
  })
})
