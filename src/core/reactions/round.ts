import type { Action } from '../decisions/types'
import type { Reaction } from './engine'

/** How a round of decisions went: who decided what, how fast, and what it cost. */
export interface RoundSummary {
  total: number
  decided: number
  errors: number
  calls: number
  /** Median time of a full answer. */
  medianMs?: number
  costUsd?: number
  costEstimated: boolean
  tokensIn?: number
  tokensOut?: number
  /** Actions taken, most common first. */
  actions: [Action, number][]
}

export function roundSummary(reactions: Reaction[]): RoundSummary {
  const listeners = reactions.filter((r) => !r.isSpeaker)
  const calls = listeners.flatMap((r) => r.calls)
  const times = calls.map((c) => c.totalMs).filter((ms): ms is number => ms !== null).sort((a, b) => a - b)
  const sum = (read: (u: NonNullable<(typeof calls)[number]['usage']>) => number | undefined) => calls.reduce((n, c) => n + (c.usage ? (read(c.usage) ?? 0) : 0), 0)
  const counts = new Map<Action, number>()
  for (const r of listeners) if (r.decision) counts.set(r.decision.action, (counts.get(r.decision.action) ?? 0) + 1)
  return {
    total: listeners.length,
    decided: listeners.filter((r) => r.decision).length,
    errors: listeners.filter((r) => r.error).length,
    calls: calls.length,
    medianMs: times.length ? Math.round(times[Math.floor((times.length - 1) / 2)]) : undefined,
    costUsd: sum((u) => u.costUsd) || undefined,
    costEstimated: calls.some((c) => c.usage?.costSource === 'table'),
    tokensIn: sum((u) => u.inputTokens) || undefined,
    tokensOut: sum((u) => u.outputTokens) || undefined,
    actions: [...counts].sort((a, b) => b[1] - a[1]),
  }
}
