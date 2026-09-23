import { describe, expect, it } from 'vitest'
import { analyze, cellKey } from '../src/core/bench/analysis'
import { checkFormat } from '../src/core/bench/format'
import { runBench, type Contender } from '../src/core/bench/runner'
import { buildScenario } from '../src/core/bench/scenarios'
import type { Decision, DecisionEvent, DecisionProvider } from '../src/core/decisions/types'
import { createRulesProvider, mockDecision } from '../src/providers/mock'
import { content } from './helpers'

const contender = (id: string, provider: DecisionProvider): Contender => ({ id, label: id, provider, concurrency: 4, timeoutMs: 5000 })

/** Answers in JSON like an LLM, but flips between two actions on alternate calls. */
function fickle(): DecisionProvider {
  let n = 0
  return {
    id: 'fickle',
    label: 'fickle',
    async *decide(ctx): AsyncIterable<DecisionEvent> {
      const decision: Decision = { ...mockDecision(ctx, content.vocabulary), action: n++ % 2 ? 'ignore' : 'go', tell: [] }
      yield { type: 'reasoning', delta: 'hmm' }
      yield { type: 'response', text: `Claro:\n${JSON.stringify(decision)}`, usage: { inputTokens: 100, outputTokens: 20 } }
      yield { type: 'final', decision }
    },
  }
}

describe('benchmark', () => {
  it('builds the same prompts for the same seed', () => {
    const a = buildScenario(content, content.examples[0], 42)
    const b = buildScenario(content, content.examples[0], 42)
    expect(a.contexts).toEqual(b.contexts)
    expect(a.contexts.length).toBe(content.residents.length - (content.examples[0].speaker.kind === 'neighbor' ? 1 : 0))
  })

  it('leaves the speaker out of their own announcement', () => {
    const ex = content.examples.find((e) => e.speaker.kind === 'neighbor')!
    expect(buildScenario(content, ex, 1).contexts.some((c) => c.resident.id === ex.speaker.residentId)).toBe(false)
  })

  it('scores consistency, format and agreement with the reference', async () => {
    const scenarios = content.examples.slice(0, 2).map((ex) => buildScenario(content, ex, 7))
    const trials = await runBench({ scenarios, repetitions: 2, contenders: [contender('rules', createRulesProvider(content.vocabulary)), contender('fickle', fickle())] })
    const cells = scenarios.reduce((n, s) => n + s.contexts.length, 0)
    expect(trials).toHaveLength(cells * 2 * 2)

    const reference = new Map(scenarios.flatMap((s) => s.contexts.map((ctx) => [cellKey(s.id, ctx.resident.id), mockDecision(ctx, content.vocabulary)] as const)))
    const report = analyze(trials, ['rules', 'fickle'], reference)
    const [rules, flaky] = report.contenders
    expect(rules.consistency).toBe(1)
    expect(rules.referenceAgreement).toBe(1)
    expect(rules.format.checked).toBe(0)
    expect(flaky.consistency).toBeLessThan(1)
    expect(flaky.format.repaired).toBe(flaky.trials)
    expect(flaky.format.issues['texto fuera del JSON']).toBe(flaky.trials)
    expect(flaky.metrics.inputTokens).toBe(100 * flaky.trials)
    expect(report.agreement['rules|fickle']).toBeGreaterThanOrEqual(0)
  })

  it('stops when cancelled', async () => {
    const controller = new AbortController()
    const scenarios = [buildScenario(content, content.examples[0], 7)]
    const slow: DecisionProvider = {
      id: 'slow',
      label: 'slow',
      async *decide(_ctx, signal): AsyncIterable<DecisionEvent> {
        await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
      },
    }
    const run = runBench({ scenarios, repetitions: 1, contenders: [contender('slow', slow)] }, { signal: controller.signal })
    controller.abort()
    expect(await run).toEqual([])
  })
})

describe('format check', () => {
  it('accepts a clean reply and flags problems', () => {
    const good = { action: 'go', believes: true, tell: [], reasoning: 'Tengo hambre.', speech: '¡Voy!', emoji: '🍖', confidence: 0.8 }
    expect(checkFormat(JSON.stringify(good)).status).toBe('ok')
    expect(checkFormat('```json\n' + JSON.stringify(good) + '\n```').status).toBe('ok')
    expect(checkFormat(JSON.stringify({ ...good, action: 'dance', confidence: 3 })).issues).toEqual(['acción desconocida', 'confianza fuera de 0–1'])
    expect(checkFormat('No sé qué hacer').status).toBe('invalid')
    expect(checkFormat('{"action": "go",}').status).toBe('invalid')
  })
})
