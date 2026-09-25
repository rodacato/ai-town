import { create } from 'zustand'
import { executeRun, trialsPerContender, type ContenderInfo } from '../../../core/bench/run'
import type { BenchProgress, Contender } from '../../../core/bench/runner'
import { createProvider } from '../../../providers'
import { EFFORT_LABEL, PRESETS, type Connection, type LlmSettings } from '../../../providers/llm/config'
import type { ReasoningEffort } from '../../../providers/llm/transport'
import { createRulesProvider, mockDecision } from '../../../providers/mock'
import { useTown } from '../../store'
import { town } from '../../town'
import { history, type BenchRun } from './history'
import { bundleRuns, mergeRuns, readRuns } from '../../../core/bench/bundle'
import { folderAccess, forgetFolder, linkedFolder, pickFolder, readFolder, removeFromFolder, writeToFolder } from './folder'
import { download } from '../experiment/export'
import { runJudge } from '../../../core/bench/judge'
import { GOLDEN_SIZE } from '../../../core/bench/golden'
import { createModelJudge } from '../../../providers/judge'

export type ContenderKind = 'rules' | Connection['kind']

export interface ContenderSpec {
  kind: ContenderKind
  model: string
  /** Turns off Anthropic's prompt cache, to measure what it saves against the same model with it. */
  noCache?: boolean
  /** Asks the host for this reasoning effort instead of the connection's, to compare efforts of one model. */
  effort?: ReasoningEffort
}

interface Prefs {
  specs: ContenderSpec[]
  scenarioIds: string[]
  repetitions: number
  seed: number
}

interface BenchState extends Prefs {
  open: boolean
  view: 'new' | 'history' | 'result' | 'compare' | 'duel'
  running: { startedAt: number; progress: Record<string, BenchProgress>; lastError: Record<string, string>; controller: AbortController } | null
  current: BenchRun | null
  runs: BenchRun[]
  setOpen: (open: boolean) => void
  setView: (view: BenchState['view']) => void
  setPrefs: (prefs: Partial<Prefs>) => void
  /** `quick` asks only the golden decisions, once each, over every announcement. */
  start: (quick?: boolean) => Promise<void>
  cancel: () => void
  loadHistory: () => Promise<void>
  show: (run: BenchRun) => void
  remove: (id: string) => Promise<void>
  /** Runs from files: one run each, or bundles of many. */
  importRuns: (files: File[]) => Promise<void>
  exportAll: () => void
  /** A folder, ideally synced across machines, where runs are saved and read; null when none is linked. */
  folder: { name: string; access: PermissionState } | null
  linkFolder: () => Promise<void>
  reconnectFolder: () => Promise<void>
  unlinkFolder: () => Promise<void>
  /** A judge model reading the current run's decisions; its verdict is saved into the run. */
  judging: { done: number; total: number; controller: AbortController } | null
  judge: (spec: { kind: Connection['kind']; model: string }, perContender: number) => Promise<void>
  cancelJudge: () => void
}

const PREFS_KEY = 'ai-town:bench-prefs'
export const MAX_REPETITIONS = 5

const uncached = (s: ContenderSpec) => s.kind === 'anthropic' && !!s.noCache
/** Runs made in the world the app is running now; the others name residents that are not here. */
export const ofThisWorld = (run: { world: string }) => run.world === town.content.id

const effortOf = (s: ContenderSpec) => (s.kind !== 'rules' && s.kind !== 'anthropic' ? s.effort : undefined)
export const specId = (s: ContenderSpec) =>
  s.kind === 'rules' ? 'rules' : `${s.kind}:${s.model.trim()}${uncached(s) ? ':no-cache' : ''}${effortOf(s) ? `:effort-${effortOf(s)}` : ''}`
export const specLabel = (s: ContenderSpec) =>
  s.kind === 'rules' ? 'Reglas locales' : `${PRESETS[s.kind].label} · ${s.model.trim() || '¿modelo?'}${uncached(s) ? ' · sin caché' : ''}${effortOf(s) ? ` · esfuerzo ${EFFORT_LABEL[effortOf(s)!]}` : ''}`

function defaultPrefs(): Prefs {
  const llm = useTown.getState().llm
  const specs: ContenderSpec[] = [{ kind: 'rules', model: '' }]
  if (llm.active !== 'mock') specs.push({ kind: llm.active, model: llm.connections[llm.active].model })
  return { specs, scenarioIds: town.content.examples.map((e) => e.id), repetitions: 3, seed: 7 }
}

function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Prefs | null
    if (saved?.specs?.length) return { ...defaultPrefs(), ...saved }
  } catch {
    // Unreadable or blocked storage just means starting from defaults.
  }
  return defaultPrefs()
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // Remembering the form is a convenience; nothing breaks without it.
  }
}

function contenderFor(spec: ContenderSpec, llm: LlmSettings): { contender: Contender; info: ContenderInfo } {
  const id = specId(spec)
  const label = specLabel(spec)
  if (spec.kind === 'rules') {
    return {
      contender: { id, label, provider: createRulesProvider(town.content.vocabulary), concurrency: 16, timeoutMs: 5000 },
      info: { id, label, kind: 'rules', model: '', host: '', concurrency: 16 },
    }
  }
  const base = llm.connections[spec.kind]
  const conn = { ...base, model: spec.model.trim(), promptCache: !uncached(spec), reasoningEffort: effortOf(spec) ?? base.reasoningEffort }
  const { provider, concurrency, timeoutMs } = createProvider({ active: spec.kind, connections: { ...llm.connections, [spec.kind]: conn } }, town.content)
  return { contender: { id, label, provider, concurrency, timeoutMs }, info: { id, label, kind: spec.kind, model: conn.model, host: conn.host, concurrency, ...(conn.reasoningEffort ? { effort: conn.reasoningEffort } : {}) } }
}

/** Saves a run in this browser and, when a folder is linked and allowed, in the folder too. */
async function keepRun(run: BenchRun, folder: BenchState['folder']) {
  await history.save(run)
  const dir = folder?.access === 'granted' ? await linkedFolder() : undefined
  if (dir) await writeToFolder(dir, run)
}

export const useBench = create<BenchState>((set, get) => ({
  ...loadPrefs(),
  open: false,
  view: 'new',
  running: null,
  current: null,
  runs: [],
  setOpen: (open) => {
    set({ open })
    if (open) void get().loadHistory()
  },
  setView: (view) => set({ view }),
  setPrefs: (prefs) => {
    set(prefs)
    const { specs, scenarioIds, repetitions, seed } = get()
    savePrefs({ specs, scenarioIds, repetitions, seed })
  },
  start: async (quick = false) => {
    const { specs, scenarioIds, seed } = get()
    const repetitions = quick ? 1 : get().repetitions
    const llm = useTown.getState().llm
    const contenders = specs.map((s) => contenderFor(s, llm))
    const examples = quick ? town.content.examples : town.content.examples.filter((e) => scenarioIds.includes(e.id))
    const controller = new AbortController()
    const total = quick ? GOLDEN_SIZE : trialsPerContender(town.content, examples, repetitions)
    const progress = Object.fromEntries(contenders.map(({ contender }) => [contender.id, { contender: contender.id, done: 0, total, errors: 0 }]))
    set({ running: { startedAt: performance.now(), progress, lastError: {}, controller }, view: 'new' })

    let pending: Record<string, BenchProgress> = {}
    let errors: Record<string, string> = {}
    let frame = 0
    const flush = () => {
      frame = 0
      const running = get().running
      if (running) set({ running: { ...running, progress: { ...running.progress, ...pending }, lastError: { ...running.lastError, ...errors } } })
      pending = {}
      errors = {}
    }
    const run = await executeRun(
      { content: town.content, examples, seed, repetitions, contenders, reference: (ctx) => mockDecision(ctx, town.content.vocabulary), quick },
      {
        signal: controller.signal,
        onTrial: (t, p) => {
          pending[p.contender] = p
          if (t.error) errors[p.contender] = t.error
          frame ||= requestAnimationFrame(flush)
        },
      },
    )
    cancelAnimationFrame(frame)
    set({ running: null, current: run, view: 'result' })
    if (run.trials.length) {
      await keepRun(run, get().folder).catch(() => useTown.getState().toast('No se pudo guardar la prueba; expórtala para no perderla.'))
      void get().loadHistory()
    }
  },
  cancel: () => get().running?.controller.abort(),
  loadHistory: async () => {
    let local: BenchRun[] = []
    try {
      local = await history.list()
    } catch {
      // Blocked storage: the history starts empty.
    }
    const dir = await linkedFolder()
    if (!dir) return set({ runs: local, folder: null })
    const access = await folderAccess(dir, false).catch((): PermissionState => 'denied')
    set({ folder: { name: dir.name, access } })
    if (access !== 'granted') return set({ runs: local })
    const shared = await readFolder(dir).catch(() => [])
    // What arrives from the folder is kept here too, so unlinking it loses nothing.
    const known = new Set(local.map((r) => r.id))
    await Promise.all(shared.filter((r) => !known.has(r.id)).map((r) => history.save(r).catch(() => undefined)))
    set({ runs: mergeRuns(local, shared) })
  },
  exportAll: () => download(`ai-town-runs-${new Date().toISOString().slice(0, 10)}.json`, bundleRuns(get().runs), 'application/json'),
  folder: null,
  linkFolder: async () => {
    try {
      const dir = await pickFolder()
      // The history so far goes into the folder, so the other machine sees it too.
      await Promise.all(get().runs.map((r) => writeToFolder(dir, r)))
      await get().loadHistory()
      useTown.getState().toast(`Las pruebas se guardan también en «${dir.name}».`)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') useTown.getState().toast('No se pudo usar esa carpeta.')
    }
  },
  reconnectFolder: async () => {
    const dir = await linkedFolder()
    if (dir) await folderAccess(dir, true).catch(() => undefined)
    await get().loadHistory()
  },
  unlinkFolder: async () => {
    await forgetFolder()
    await get().loadHistory()
  },
  show: (run) => set({ current: run, view: 'result' }),
  importRuns: async (files) => {
    const { toast } = useTown.getState()
    const runs: BenchRun[] = []
    for (const file of files) {
      try {
        runs.push(...readRuns(await file.text()))
      } catch (err) {
        toast(`«${file.name}»: ${err instanceof Error ? err.message : 'no se pudo leer.'}`)
      }
    }
    if (!runs.length) return
    await Promise.all(runs.map((r) => keepRun(r, get().folder)))
    await get().loadHistory()
    if (runs.length === 1) set({ current: runs[0], view: 'result' })
    else toast(`${runs.length} pruebas importadas.`)
  },
  judging: null,
  judge: async (spec, perContender) => {
    const run = get().current
    if (!run) return
    const connection = { ...useTown.getState().llm.connections[spec.kind], model: spec.model.trim() }
    const controller = new AbortController()
    set({ judging: { done: 0, total: 0, controller } })
    try {
      const verdict = await runJudge({
        run,
        content: town.content,
        judge: `${PRESETS[spec.kind].label} · ${connection.model}`,
        perContender,
        ask: createModelJudge(connection),
        concurrency: Math.min(3, connection.concurrency),
        signal: controller.signal,
        onProgress: (done, total) => set({ judging: { done, total, controller } }),
      })
      const judged = { ...run, judge: verdict }
      await keepRun(judged, get().folder).catch(() => useTown.getState().toast('No se pudo guardar el juicio; exporta la prueba para no perderlo.'))
      set({ current: judged, runs: get().runs.map((r) => (r.id === judged.id ? judged : r)) })
    } catch (err) {
      if (!controller.signal.aborted) useTown.getState().toast(`El juez no pudo terminar: ${err instanceof Error ? err.message : 'error'}`)
    } finally {
      set({ judging: null })
    }
  },
  cancelJudge: () => get().judging?.controller.abort(),
  remove: async (id) => {
    await history.remove(id)
    const dir = get().folder?.access === 'granted' ? await linkedFolder() : undefined
    if (dir) await removeFromFolder(dir, id).catch(() => useTown.getState().toast('Se borró de este navegador, pero no de la carpeta compartida.'))
    if (get().current?.id === id) set({ current: null, view: 'history' })
    await get().loadHistory()
  },
}))
