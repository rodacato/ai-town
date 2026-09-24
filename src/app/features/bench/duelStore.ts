import { create } from 'zustand'
import { absentDuelist, rulesDuelist, runDuel, type Duelist, type DuelResult } from '../../../core/realm/duel'
import type { Difficulty } from '../../../core/realm/difficulty'
import { GOALS } from '../../../core/realm/standing'
import { SEASON_DAYS } from '../../../core/realm/terrarium'
import type { ProviderKind } from '../../../providers/llm/config'
import { createModelRuler } from '../../../providers/ruler'
import { useTown } from '../../store'
import { town } from '../../town'

export interface DuelModel {
  kind: Exclude<ProviderKind, 'mock'>
  model: string
}

export const duelModelId = (m: DuelModel) => `${m.kind}:${m.model.trim()}`

interface DuelState {
  seed: number
  difficulty: Difficulty
  absent: boolean
  rules: boolean
  models: DuelModel[]
  /** Day reached by each ruler while the duel runs. */
  running: { progress: Record<string, number>; controller: AbortController } | null
  result: DuelResult | null
  error: string | null
  set: (patch: Partial<Pick<DuelState, 'seed' | 'difficulty' | 'absent' | 'rules' | 'models'>>) => void
  start: () => Promise<void>
  cancel: () => void
}

export const DUEL_DAYS = GOALS.yearDays + 1

/** A ruler played by a model, with the connection set up in Configuración and this model's own price. */
function modelDuelist(m: DuelModel): Duelist {
  const connection = { ...useTown.getState().llm.connections[m.kind], model: m.model.trim() }
  const ruler = createModelRuler(connection)
  return { id: duelModelId(m), label: `${connection.model} (${m.kind})`, decide: (report, signal) => ruler(report, AbortSignal.any([signal, AbortSignal.timeout(120_000)])) }
}

/** The duel runs outside the dialog, so it keeps going while other tabs are open. */
export const useDuel = create<DuelState>((set, get) => ({
  seed: 12,
  difficulty: 'normal',
  absent: true,
  rules: true,
  models: [],
  running: null,
  result: null,
  error: null,
  set: (patch) => set(patch),
  start: async () => {
    const { seed, difficulty, absent, rules, models } = get()
    const rulers = [...(absent ? [absentDuelist] : []), ...(rules ? [rulesDuelist] : []), ...models.filter((m) => m.model.trim()).map(modelDuelist)]
    const controller = new AbortController()
    set({ running: { progress: Object.fromEntries(rulers.map((r) => [r.id, 0])), controller }, error: null })
    try {
      const result = await runDuel({
        content: town.content,
        seed,
        days: DUEL_DAYS,
        difficulty,
        seasonLength: SEASON_DAYS,
        rulers,
        signal: controller.signal,
        onDay: (id, day) => set((s) => (s.running ? { running: { ...s.running, progress: { ...s.running.progress, [id]: day + 1 } } } : {})),
      })
      set({ result, running: null })
    } catch (err) {
      set({ running: null, error: controller.signal.aborted ? null : err instanceof Error ? err.message : 'El duelo se detuvo.' })
    }
  },
  cancel: () => get().running?.controller.abort(),
}))
