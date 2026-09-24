import { RUN_FORMAT, type BenchRun } from './run'

/** Many runs in one file, to carry a whole history to another machine. */
export const BUNDLE_FORMAT = 'ai-town-bench-bundle/1'

const isRun = (x: unknown): x is BenchRun => {
  const r = x as BenchRun | null
  return r?.format === RUN_FORMAT && typeof r.id === 'string' && Array.isArray(r.trials) && !!r.report?.contenders
}

/** The runs in a file: one run, as the app and `npm run bench` write them, or a bundle of many. Throws if it is neither. */
export function readRuns(text: string): BenchRun[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es JSON.')
  }
  if (isRun(data)) return [data]
  const bundle = data as { format?: string; runs?: unknown[] } | null
  if (bundle?.format === BUNDLE_FORMAT && Array.isArray(bundle.runs)) return bundle.runs.filter(isRun)
  throw new Error('No es una prueba de AI Town (ni una sola ni un lote exportado).')
}

export const bundleRuns = (runs: BenchRun[]) => JSON.stringify({ format: BUNDLE_FORMAT, exportedAt: Date.now(), runs })

/** One copy per run, newest first; when the same run comes twice, the one with a judge's verdict wins. */
export function mergeRuns(...lists: BenchRun[][]): BenchRun[] {
  const byId = new Map<string, BenchRun>()
  for (const run of lists.flat()) {
    const had = byId.get(run.id)
    if (!had || (!had.judge && run.judge)) byId.set(run.id, run)
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
}

/** A readable, unique name for a run saved as a file. */
export const runFileName = (run: BenchRun) => `${run.world}-${new Date(run.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${run.id.slice(0, 8)}.json`
