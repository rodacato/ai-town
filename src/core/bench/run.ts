import type { Decision, DecisionContext } from '../decisions/types'
import type { Example, WorldContent } from '../world/content'
import { analyze, cellKey, type BenchReport } from './analysis'
import { runBench, type BenchProgress, type Contender, type Trial } from './runner'
import { buildScenario } from './scenarios'

export const RUN_FORMAT = 'ai-town-bench/1'

export interface ContenderInfo {
  id: string
  label: string
  kind: string
  model: string
  host: string
  concurrency: number
}

/** A finished run, the same shape in the browser history, the CLI output and exported files. */
export interface BenchRun {
  format: typeof RUN_FORMAT
  id: string
  createdAt: number
  world: string
  seed: number
  repetitions: number
  scenarios: { id: string; text: string; tone: string; truth?: boolean }[]
  contenders: ContenderInfo[]
  durationMs: number
  durations: Record<string, number>
  /** Optional so runs saved before it existed still load. */
  stopped?: string[]
  cancelled: boolean
  trials: Trial[]
  report: BenchReport
}

export interface RunSetup {
  content: WorldContent
  examples: Example[]
  seed: number
  repetitions: number
  contenders: { contender: Contender; info: ContenderInfo }[]
  /** What the rule-based mode would decide, to score agreement against. */
  reference?: (ctx: DecisionContext) => Decision
}

export async function executeRun(setup: RunSetup, opts: { signal?: AbortSignal; onTrial?: (t: Trial, p: BenchProgress) => void } = {}): Promise<BenchRun> {
  const { content, examples, seed, repetitions, contenders, reference } = setup
  const scenarios = examples.map((e) => buildScenario(content, e, seed))
  const refs = reference ? new Map(scenarios.flatMap((s) => s.contexts.map((ctx) => [cellKey(s.id, ctx.resident.id), reference(ctx)] as const))) : undefined
  const startedAt = performance.now()
  const { trials, durations, stopped } = await runBench({ scenarios, repetitions, contenders: contenders.map((c) => c.contender) }, opts)
  return {
    format: RUN_FORMAT,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    world: content.id,
    seed,
    repetitions,
    scenarios: examples.map((e) => ({ id: e.id, text: e.text, tone: e.tone, truth: e.truth })),
    contenders: contenders.map((c) => c.info),
    durationMs: performance.now() - startedAt,
    durations,
    stopped,
    cancelled: !!opts.signal?.aborted,
    trials,
    report: analyze(trials, contenders.map((c) => c.contender.id), refs),
  }
}

/** Residents asked per contender: everyone but a neighbor who made the announcement, times repetitions. */
export const trialsPerContender = (content: WorldContent, examples: Example[], repetitions: number) =>
  examples.reduce((n, e) => n + content.residents.length - (e.speaker.kind === 'neighbor' ? 1 : 0), 0) * repetitions
