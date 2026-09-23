import { describe, expect, it } from 'vitest'
import type { CallRecord } from '../src/core/reactions/engine'
import { percentiles, runMetrics } from '../src/core/reactions/metrics'
import { estimateCost, knownPrice } from '../src/providers/llm/pricing'

const call = (over: Partial<CallRecord>): CallRecord => ({
  provider: 'x',
  at: 0,
  queueMs: 0,
  ttftMs: 100,
  totalMs: 1100,
  usage: { inputTokens: 1000, outputTokens: 200, costUsd: 0.01, costSource: 'host' },
  action: 'go',
  believes: true,
  error: null,
  revision: false,
  ...over,
})

describe('metrics', () => {
  it('computes nearest-rank percentiles', () => {
    expect(percentiles([5, 1, 3, 2, 4])).toEqual({ p50: 3, p95: 5, max: 5 })
    expect(percentiles([])).toBeNull()
  })

  it('totals tokens and cost and leaves failed calls out of latency', () => {
    const m = runMetrics([call({}), call({ totalMs: 2100 }), call({ error: 'boom', usage: null, totalMs: 9000, ttftMs: null })])
    expect(m).toMatchObject({ calls: 3, errors: 1, inputTokens: 2000, outputTokens: 400, costEstimated: false })
    expect(m.costUsd).toBeCloseTo(0.02)
    expect(m.total?.max).toBe(2100)
    expect(m.tokensPerSecond).toBeCloseTo(400 / 3)
  })

  it('reports no cost when nothing was priced', () => {
    expect(runMetrics([call({ usage: { inputTokens: 10, outputTokens: 5 } })]).costUsd).toBeNull()
  })

  it('estimates cost from list prices per million tokens', () => {
    expect(estimateCost(knownPrice('claude-haiku-4-5-20251001'), 1_000_000, 1_000_000)).toBe(6)
    expect(estimateCost(knownPrice('some-local-model'), 10, 10)).toBeUndefined()
  })
})
