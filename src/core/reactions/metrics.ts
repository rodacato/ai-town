import { usd } from '../format'
import type { CallRecord, Reaction } from './engine'

export interface RunMetrics {
  calls: number
  errors: number
  inputTokens: number
  outputTokens: number
  /** Prompt tokens read from and written to the cache; optional for runs saved before they were counted. */
  cacheReadTokens?: number
  cacheWriteTokens?: number
  /** What the cache saved against paying every prompt token in full; null when there is no price to tell. */
  cacheSavedUsd?: number | null
  /** Null when no call reported or could estimate a cost. */
  costUsd: number | null
  /** True when some cost came from a price table rather than the host. */
  costEstimated: boolean
  ttft: Percentiles | null
  total: Percentiles | null
  queue: Percentiles | null
  /** Output tokens per second of generation, across successful calls. */
  tokensPerSecond: number | null
}

export interface Percentiles {
  p50: number
  p95: number
  max: number
}

export function percentiles(values: number[]): Percentiles | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]
  return { p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] }
}

export const allCalls = (reactions: Iterable<Reaction>) => [...reactions].flatMap((r) => r.calls.map((c) => ({ id: r.id, ...c })))

/** The fields metrics need, shared by live calls and benchmark trials. */
export type Timed = Pick<CallRecord, 'queueMs' | 'ttftMs' | 'totalMs' | 'usage' | 'error'>

export function runMetrics(calls: Timed[]): RunMetrics {
  const ok = calls.filter((c) => !c.error)
  const sum = (f: (c: Timed) => number | undefined) => calls.reduce((n, c) => n + (f(c) ?? 0), 0)
  const priced = calls.filter((c) => c.usage?.costUsd !== undefined)
  const generating = ok.filter((c) => c.usage?.outputTokens && c.totalMs && c.ttftMs !== null)
  const genSeconds = generating.reduce((n, c) => n + (c.totalMs! - c.ttftMs!) / 1000, 0)
  return {
    calls: calls.length,
    errors: calls.length - ok.length,
    inputTokens: sum((c) => c.usage?.inputTokens),
    outputTokens: sum((c) => c.usage?.outputTokens),
    cacheReadTokens: sum((c) => c.usage?.cacheReadTokens),
    cacheWriteTokens: sum((c) => c.usage?.cacheWriteTokens),
    cacheSavedUsd: calls.some((c) => c.usage?.cacheSavedUsd !== undefined) ? sum((c) => c.usage?.cacheSavedUsd) : null,
    costUsd: priced.length ? sum((c) => c.usage?.costUsd) : null,
    costEstimated: priced.some((c) => c.usage?.costSource === 'table'),
    ttft: percentiles(ok.flatMap((c) => (c.ttftMs !== null ? [c.ttftMs] : []))),
    total: percentiles(ok.flatMap((c) => (c.totalMs !== null ? [c.totalMs] : []))),
    queue: percentiles(calls.map((c) => c.queueMs)),
    tokensPerSecond: genSeconds > 0 ? generating.reduce((n, c) => n + c.usage!.outputTokens!, 0) / genSeconds : null,
  }
}

/** Share of the prompt that came from the cache; null when nothing was cached, or the host does not say. */
export function cacheShare(m: RunMetrics): number | null {
  const read = m.cacheReadTokens ?? 0
  const prompt = m.inputTokens + read + (m.cacheWriteTokens ?? 0)
  return read && prompt ? read / prompt : null
}

/** The cache in one cell: what share of the prompt it served and what that saved or, while it only fills, cost. */
export function cacheText(m: RunMetrics): string {
  const share = cacheShare(m)
  const saved = m.cacheSavedUsd
  const money = !saved ? '' : saved > 0 ? ` · ahorró ${usd(saved, true)}` : ` · costó ${usd(-saved, true)} de más`
  if (share === null) return m.cacheWriteTokens ? `solo escrita${money}` : '—'
  return `${Math.round(share * 100)}%${money}`
}
