import type { Decision, DecisionContext } from '../decisions/types'
import type { Example, WorldContent } from '../world/content'
import { analyze, cellKey, type BenchReport } from './analysis'
import { runBench, type BenchProgress, type Contender, type Trial } from './runner'
import type { RunJudgment } from './judge'
import { goldenCases, goldenScore, type GoldenCase } from './golden'
import { buildScenario } from './scenarios'

export const RUN_FORMAT = 'ai-town-bench/1'

export interface ContenderInfo {
  id: string
  label: string
  kind: string
  model: string
  host: string
  concurrency: number
  /** Reasoning effort asked of the host, when the run set one. */
  effort?: string
}

/** A finished run, the same shape in the browser history, the CLI output and exported files. */
export interface BenchRun {
  format: typeof RUN_FORMAT
  id: string
  createdAt: number
  world: string
  seed: number
  repetitions: number
  scenarios: { id: string; text: string; tone: Example['tone']; truth?: boolean }[]
  contenders: ContenderInfo[]
  durationMs: number
  durations: Record<string, number>
  /** Optional so runs saved before it existed still load. */
  stopped?: string[]
  cancelled: boolean
  trials: Trial[]
  report: BenchReport
  /** A judge model's reading of how in character the decisions were; added after the run, if asked. */
  judge?: RunJudgment
  /** The decisions with only one right answer, picked on their own; absent in runs made before them. */
  golden?: GoldenCase[]
  /** Only the golden decisions were asked: a quick, cheap check. */
  quick?: boolean
}

export interface RunSetup {
  content: WorldContent
  examples: Example[]
  seed: number
  repetitions: number
  contenders: { contender: Contender; info: ContenderInfo }[]
  /** What the rule-based mode would decide, to score agreement against. */
  reference?: (ctx: DecisionContext) => Decision
  /** Ask only the golden decisions. */
  quick?: boolean
}

export async function executeRun(setup: RunSetup, opts: { signal?: AbortSignal; onTrial?: (t: Trial, p: BenchProgress) => void } = {}): Promise<BenchRun> {
  const { content, examples, seed, repetitions, contenders, reference, quick } = setup
  const built = examples.map((e) => buildScenario(content, e, seed))
  const golden = reference ? goldenCases(built, reference) : []
  const isGolden = (s: string, r: string) => golden.some((g) => g.scenario === s && g.resident === r)
  const scenarios = quick ? built.map((s) => ({ ...s, contexts: s.contexts.filter((ctx) => isGolden(s.id, ctx.resident.id)) })).filter((s) => s.contexts.length) : built
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
    report: withGolden(analyze(trials, contenders.map((c) => c.contender.id), refs), golden, trials),
    ...(golden.length ? { golden } : {}),
    ...(quick ? { quick } : {}),
  }
}

function withGolden(report: BenchReport, golden: GoldenCase[], trials: Trial[]): BenchReport {
  if (!golden.length) return report
  return { ...report, contenders: report.contenders.map((c) => ({ ...c, golden: goldenScore(golden, trials, c.contender) })) }
}

/** Residents asked per contender: everyone but a neighbor who made the announcement, times repetitions. */
export const trialsPerContender = (content: WorldContent, examples: Example[], repetitions: number) =>
  examples.reduce((n, e) => n + content.residents.length - (e.speaker.kind === 'neighbor' ? 1 : 0), 0) * repetitions

const OLD_TONES: Record<string, Example['tone']> = { confiable: 'trusted', urgente: 'urgent', sospechoso: 'suspicious', emergencia: 'emergency' }

/** A run saved before the code went English, as JSON text: Spanish tones and contender id suffixes become today's. */
export const upgradeRunText = (text: string) =>
  text
    .replace(/"tone":"(confiable|urgente|sospechoso|emergencia)"/g, (_, tone: string) => `"tone":"${OLD_TONES[tone]}"`)
    .replace(/:sin-cache(?=[":])/g, ':no-cache')
    .replace(/:esfuerzo-(minimal|low|medium|high)(?=[":])/g, ':effort-$1')

/** The same, for a run already parsed, as the browser keeps them. */
export function upgradeRun(run: BenchRun): BenchRun {
  const text = JSON.stringify(run)
  const next = upgradeRunText(text)
  return next === text ? run : (JSON.parse(next) as BenchRun)
}
