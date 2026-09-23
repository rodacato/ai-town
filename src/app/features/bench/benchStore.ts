import { create } from 'zustand'
import { executeRun, RUN_FORMAT, trialsPerContender, type ContenderInfo } from '../../../core/bench/run'
import type { BenchProgress, Contender } from '../../../core/bench/runner'
import { createProvider } from '../../../providers'
import { PRESETS, type Connection, type LlmSettings } from '../../../providers/llm/config'
import { createRulesProvider, mockDecision } from '../../../providers/mock'
import { useTown } from '../../store'
import { town } from '../../town'
import { history, type BenchRun } from './history'

export type ContenderKind = 'rules' | Connection['kind']

export interface ContenderSpec {
  kind: ContenderKind
  model: string
}

interface Prefs {
  specs: ContenderSpec[]
  scenarioIds: string[]
  repetitions: number
  seed: number
}

interface BenchState extends Prefs {
  open: boolean
  view: 'new' | 'history' | 'result'
  running: { startedAt: number; progress: Record<string, BenchProgress>; lastError: Record<string, string>; controller: AbortController } | null
  current: BenchRun | null
  runs: BenchRun[]
  setOpen: (open: boolean) => void
  setView: (view: BenchState['view']) => void
  setPrefs: (prefs: Partial<Prefs>) => void
  start: () => Promise<void>
  cancel: () => void
  loadHistory: () => Promise<void>
  show: (run: BenchRun) => void
  remove: (id: string) => Promise<void>
  importRun: (file: File) => Promise<void>
}

const PREFS_KEY = 'ai-town:bench-prefs'
export const MAX_REPETITIONS = 5

export const specId = (s: ContenderSpec) => (s.kind === 'rules' ? 'rules' : `${s.kind}:${s.model.trim()}`)
export const specLabel = (s: ContenderSpec) => (s.kind === 'rules' ? 'Reglas locales' : `${PRESETS[s.kind].label} · ${s.model.trim() || '¿modelo?'}`)

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
  const conn = { ...llm.connections[spec.kind], model: spec.model.trim() }
  const { provider, concurrency, timeoutMs } = createProvider({ active: spec.kind, connections: { ...llm.connections, [spec.kind]: conn } }, town.content)
  return { contender: { id, label, provider, concurrency, timeoutMs }, info: { id, label, kind: spec.kind, model: conn.model, host: conn.host, concurrency } }
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
  start: async () => {
    const { specs, scenarioIds, repetitions, seed } = get()
    const llm = useTown.getState().llm
    const contenders = specs.map((s) => contenderFor(s, llm))
    const examples = town.content.examples.filter((e) => scenarioIds.includes(e.id))
    const controller = new AbortController()
    const total = trialsPerContender(town.content, examples, repetitions)
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
      { content: town.content, examples, seed, repetitions, contenders, reference: (ctx) => mockDecision(ctx, town.content.vocabulary) },
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
      await history.save(run).catch(() => useTown.getState().toast('No se pudo guardar la prueba en este navegador; expórtala para no perderla.'))
      void get().loadHistory()
    }
  },
  cancel: () => get().running?.controller.abort(),
  loadHistory: async () => {
    try {
      set({ runs: await history.list() })
    } catch {
      set({ runs: [] })
    }
  },
  show: (run) => set({ current: run, view: 'result' }),
  importRun: async (file) => {
    const { toast } = useTown.getState()
    try {
      const run = JSON.parse(await file.text()) as BenchRun
      if (run?.format !== RUN_FORMAT || !Array.isArray(run.trials) || !run.report?.contenders) throw new Error('format')
      await history.save(run)
      await get().loadHistory()
      set({ current: run, view: 'result' })
    } catch {
      toast('Ese archivo no es una prueba de AI Town (JSON de «npm run bench» o exportado de aquí).')
    }
  },
  remove: async (id) => {
    await history.remove(id)
    if (get().current?.id === id) set({ current: null, view: 'history' })
    await get().loadHistory()
  },
}))
