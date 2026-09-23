import { DecisionScheduler } from '../decisions/scheduler'
import type { Action, Decision, DecisionContext, DecisionProvider, TokenUsage } from '../decisions/types'
import { checkFormat, type FormatCheck } from './format'
import type { Scenario } from './scenarios'

export interface Contender {
  id: string
  label: string
  provider: DecisionProvider
  concurrency: number
  timeoutMs: number
}

export interface Trial {
  contender: string
  scenario: string
  resident: string
  rep: number
  action: Action | null
  believes: boolean | null
  confidence: number | null
  speech: string | null
  error: string | null
  /** Null when the provider does not answer in text (the rule-based mode). */
  format: FormatCheck | null
  queueMs: number
  ttftMs: number | null
  totalMs: number | null
  usage: TokenUsage | null
}

export interface BenchPlan {
  scenarios: Scenario[]
  contenders: Contender[]
  repetitions: number
}

export interface BenchProgress {
  contender: string
  done: number
  total: number
  errors: number
}

export interface BenchResult {
  trials: Trial[]
  /** Wall-clock time per contender, for throughput. */
  durations: Record<string, number>
  /** Contenders stopped because their first requests all failed. */
  stopped: string[]
}

/** If this many requests fail before any succeeds, the rest would fail too: stop instead of hammering the host. */
export const FAIL_FAST_AFTER = 5

/** Runs every contender over every scenario and resident, one contender at a time so they do not compete for the same host. */
export async function runBench(plan: BenchPlan, opts: { signal?: AbortSignal; onTrial?: (t: Trial, p: BenchProgress) => void } = {}): Promise<BenchResult> {
  const trials: Trial[] = []
  const durations: Record<string, number> = {}
  const stopped: string[] = []
  for (const contender of plan.contenders) {
    if (opts.signal?.aborted) break
    const started = performance.now()
    const jobs = plan.scenarios.flatMap((s) => s.contexts.flatMap((ctx) => Array.from({ length: plan.repetitions }, (_, rep) => ({ s, ctx, rep }))))
    const progress: BenchProgress = { contender: contender.id, done: 0, total: jobs.length, errors: 0 }
    const scheduler = new DecisionScheduler(contender.provider, contender.concurrency, contender.timeoutMs)
    const waiting = new Set<() => void>()
    const giveUp = () => {
      scheduler.cancelAll()
      for (const resolve of waiting) resolve()
    }
    const cancel = () => scheduler.cancelAll()
    opts.signal?.addEventListener('abort', cancel, { once: true })
    await Promise.all(
      jobs.map(
        ({ s, ctx, rep }) =>
          new Promise<void>((resolve) => {
            const finish = (t: Trial) => {
              trials.push(t)
              progress.done++
              if (t.error) progress.errors++
              opts.onTrial?.(t, { ...progress })
              resolve()
              if (progress.errors === FAIL_FAST_AFTER && progress.done === FAIL_FAST_AFTER) {
                stopped.push(contender.id)
                giveUp()
              }
            }
            track(scheduler, contender.id, s.id, ctx, rep, finish)
            waiting.add(resolve)
            opts.signal?.addEventListener('abort', () => resolve(), { once: true })
          }),
      ),
    )
    opts.signal?.removeEventListener('abort', cancel)
    durations[contender.id] = performance.now() - started
  }
  return { trials, durations, stopped }
}

function track(scheduler: DecisionScheduler, contender: string, scenario: string, ctx: DecisionContext, rep: number, finish: (t: Trial) => void) {
  const queued = performance.now()
  let started: number | null = null
  let firstToken: number | null = null
  let text: string | null = null
  let usage: TokenUsage | null = null
  const base = () => ({
    contender,
    scenario,
    resident: ctx.resident.id,
    rep,
    queueMs: (started ?? performance.now()) - queued,
    ttftMs: started !== null && firstToken !== null ? firstToken - started : null,
    totalMs: started !== null ? performance.now() - started : null,
    usage,
  })
  scheduler.enqueue({
    ctx,
    onStart: () => (started = performance.now()),
    onReasoning: () => (firstToken ??= performance.now()),
    onResponse: (t, u) => ((text = t), (usage = u ?? null)),
    onDecision: (d: Decision) =>
      finish({ ...base(), action: d.action, believes: d.believes, confidence: d.confidence, speech: d.speech, error: null, format: text === null ? null : checkFormat(text) }),
    onError: (message) =>
      finish({ ...base(), action: null, believes: null, confidence: null, speech: null, error: message, format: text === null ? null : checkFormat(text) }),
  })
}
