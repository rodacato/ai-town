import type { TokenUsage } from '../../core/decisions/types'
import type { Connection } from './config'

/** When the list prices below were last checked against the providers' pages. */
export const PRICES_AS_OF = '2026-06-24'

/** USD per million tokens [input, output], list prices; longer names first so «opus-5-5» is not read as «opus-5». */
const KNOWN: [name: string, input: number, output: number][] = [
  ['claude-fable-5-1', 10, 50],
  ['claude-fable-5', 10, 50],
  ['claude-opus-5-5', 4, 20],
  ['claude-opus-5', 5, 25],
  ['claude-opus-4-8', 5, 25],
  ['claude-opus-4-7', 5, 25],
  ['claude-opus-4-6', 5, 25],
  ['claude-opus-4-5', 5, 25],
  ['claude-sonnet-5', 2, 10],
  ['claude-sonnet-4', 3, 15],
  ['claude-haiku-4-5', 1, 5],
]

export interface Price {
  input: number
  output: number
}

/** Where a price comes from: typed in for this model, the provider's list, or a model running on this machine. */
export type PriceSource = 'custom' | 'list' | 'local'

/** The list price of a model, also when a gateway prefixes it («anthropic/claude-opus-5»). */
export function knownPrice(model: string): Price | null {
  const m = model.toLowerCase()
  const hit = KNOWN.find(([name]) => m.includes(name))
  return hit ? { input: hit[1], output: hit[2] } : null
}

const LOCAL_HOST = /^(https?:\/\/)?(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i

/** The price to estimate with, and where it comes from; null when nothing is known, which is not the same as free. */
export function priceInfo(c: Connection): { price: Price; source: PriceSource } | null {
  if (c.priceIn !== undefined && c.priceOut !== undefined && c.priceModel === c.model) return { price: { input: c.priceIn, output: c.priceOut }, source: 'custom' }
  const list = knownPrice(c.model)
  if (list) return { price: list, source: 'list' }
  if (c.kind === 'custom' && LOCAL_HOST.test(c.host.trim())) return { price: { input: 0, output: 0 }, source: 'local' }
  return null
}

export const priceFor = (c: Connection) => priceInfo(c)?.price ?? null

/** Prompt cache prices against the normal input price: reads about a tenth, 5-minute writes a quarter more. */
export const CACHE_READ = 0.1
export const CACHE_WRITE = 1.25

export function estimateCost(price: Price | null, inputTokens?: number, outputTokens?: number, cacheRead = 0, cacheWrite = 0) {
  if (!price || inputTokens === undefined || outputTokens === undefined) return undefined
  return (inputTokens * price.input + cacheRead * price.input * CACHE_READ + cacheWrite * price.input * CACHE_WRITE + outputTokens * price.output) / 1_000_000
}

/** What the cache saved against sending every token at the normal input price; negative while it is still being written. */
export const cacheSavings = (price: Price, cacheRead: number, cacheWrite: number) => (cacheRead * price.input * (1 - CACHE_READ) - cacheWrite * price.input * (CACHE_WRITE - 1)) / 1_000_000

/** A call's usage with its cost: the host's figure when it reports one, else estimated from the price, marked as such. */
export function withCost(c: Connection, usage: TokenUsage): TokenUsage {
  const price = priceFor(c)
  const cached = usage.cacheReadTokens || usage.cacheWriteTokens
  if (price && cached) usage = { ...usage, cacheSavedUsd: cacheSavings(price, usage.cacheReadTokens ?? 0, usage.cacheWriteTokens ?? 0) }
  if (usage.costUsd !== undefined) return { ...usage, costSource: 'host' }
  const estimated = estimateCost(priceFor(c), usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens)
  return { ...usage, costUsd: estimated, costSource: estimated === undefined ? undefined : 'table' }
}

/** Rough token count of a text: about 3.5 characters per token in Spanish prose. */
export const roughTokens = (text: string) => Math.ceil(text.length / 3.5)

/** Typical length of a resident's reply (reasoning plus the JSON decision). */
export const TYPICAL_REPLY_TOKENS = 250
