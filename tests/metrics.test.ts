import { describe, expect, it } from 'vitest'
import type { CallRecord } from '../src/core/reactions/engine'
import { cacheShare, cacheText, percentiles, runMetrics } from '../src/core/reactions/metrics'
import { cacheSavings, estimateCost, knownPrice, withCost } from '../src/providers/llm/pricing'
import { DEFAULT_SETTINGS } from '../src/providers/llm/config'

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

describe('how figures read', () => {
  it('tells an unknown price from a free one, and marks estimates', async () => {
    const { usd, clip } = await import('../src/core/format')
    expect(usd(null)).toBe('sin precio')
    expect(usd(0)).toBe('$0')
    expect(usd(0.00123)).toBe('$0.0012')
    expect(usd(0.456, true)).toBe('≈ $0.456')
    expect(usd(12.5)).toBe('$12.50')
    expect(clip('abcdef', 4)).toBe('abc…')
  })

  it('estimates what a run will cost from its real prompts, and nothing when the model has no price', async () => {
    const { estimateRunCost, promptTokens } = await import('../src/app/features/bench/estimate')
    const { DEFAULT_SETTINGS } = await import('../src/providers/llm/config')
    const { content } = await import('./helpers')
    const avg = promptTokens(content, content.examples.slice(0, 1), 7)
    expect(avg).toBeGreaterThan(200)
    const opus = { ...DEFAULT_SETTINGS.connections.anthropic, model: 'claude-opus-5' }
    const sonnet = { ...opus, model: 'claude-sonnet-5' }
    expect(estimateRunCost(opus, 100, avg)!).toBeGreaterThan(estimateRunCost(sonnet, 100, avg)!)
    expect(estimateRunCost({ ...DEFAULT_SETTINGS.connections.shellm, model: 'claude' }, 100, avg)).toBeNull()
  })
})

describe('prompt cache', () => {
  const price = { input: 3, output: 15 }

  it('prices cached reads at a tenth and writes at a quarter more', () => {
    expect(estimateCost(price, 0, 0, 1_000_000, 0)).toBeCloseTo(0.3)
    expect(estimateCost(price, 0, 0, 0, 1_000_000)).toBeCloseTo(3.75)
    expect(estimateCost(price, 1_000_000, 0, 1_000_000, 1_000_000)).toBeCloseTo(3 + 0.3 + 3.75)
  })

  it('saves what the reads avoid, minus what the writes add', () => {
    expect(cacheSavings(price, 1_000_000, 0)).toBeCloseTo(2.7)
    expect(cacheSavings(price, 0, 1_000_000)).toBeCloseTo(-0.75)
  })

  it('adds the saving to a priced call and leaves unpriced ones alone', () => {
    const conn = { ...DEFAULT_SETTINGS.connections.anthropic, model: 'claude-sonnet-5' }
    const priced = withCost(conn, { inputTokens: 100, outputTokens: 10, cacheReadTokens: 2000 })
    expect(priced.cacheSavedUsd).toBeGreaterThan(0)
    expect(withCost({ ...conn, model: 'modelo-sin-precio' }, { inputTokens: 100, outputTokens: 10, cacheReadTokens: 2000 }).cacheSavedUsd).toBeUndefined()
  })

  it('reports the share of the prompt read from the cache across a run', () => {
    const m = runMetrics([
      call({ usage: { inputTokens: 200, outputTokens: 50, cacheWriteTokens: 1800, cacheSavedUsd: -0.001 } }),
      call({ usage: { inputTokens: 200, outputTokens: 50, cacheReadTokens: 1800, cacheSavedUsd: 0.005 } }),
    ])
    expect(m).toMatchObject({ cacheReadTokens: 1800, cacheWriteTokens: 1800 })
    expect(cacheShare(m)).toBeCloseTo(1800 / 4000)
    expect(cacheText(m)).toBe('45% · ahorró ≈ $0.0040')
    expect(cacheText(runMetrics([call({})]))).toBe('—')
  })
})

describe('what the host reports', () => {
  it('adds up reasoning tokens and takes percentiles of the host queue, only over calls that report it', () => {
    const m = runMetrics([
      call({ usage: { inputTokens: 10, outputTokens: 50, reasoningTokens: 20, hostQueueMs: 1000 } }),
      call({ usage: { inputTokens: 10, outputTokens: 50, reasoningTokens: 30, hostQueueMs: 3000 } }),
      call({ usage: { inputTokens: 10, outputTokens: 50 } }),
    ])
    expect(m.reasoningTokens).toBe(50)
    expect(m.hostQueue).toMatchObject({ p50: 1000, max: 3000 })
    expect(runMetrics([call({})]).hostQueue).toBeNull()
  })
})
