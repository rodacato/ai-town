import { create } from 'zustand'
import type { Example } from './data/announcements'
import type { TownRenderer } from './render/TownRenderer'
import { detectPlace, type Announcement, type Speaker } from './sim/announcement'
import { ReactionEngine, type Reaction } from './agents/engine'
import { mockProvider } from './agents/mock'
import { DecisionScheduler } from './agents/scheduler'
import { loadSettings, saveSettings, type LlmSettings } from './agents/llm/config'
import { createLlmProvider } from './agents/llm/provider'
import type { DecisionProvider } from './agents/types'
import { Simulation } from './sim/simulation'

export const LAYOUT = { panelWidth: 380, gutter: 24, timelineHeight: 92 }
export const MAP_INSETS = {
  right: LAYOUT.panelWidth + LAYOUT.gutter + 16,
  bottom: LAYOUT.timelineHeight + LAYOUT.gutter + 12,
}
export const MAX_ANNOUNCEMENT_LENGTH = 200

export interface Toast {
  id: number
  text: string
}

interface TownState {
  sim: Simulation
  engine: ReactionEngine
  reactions: Record<string, Reaction>
  complete: boolean
  renderer: TownRenderer | null
  ready: boolean
  hoveredId: string | null
  selectedId: string | null
  minutes: number
  outside: number
  interacted: boolean
  draft: { text: string; speaker: Speaker }
  announcement: Announcement | null
  resetting: boolean
  toasts: Toast[]
  llm: LlmSettings
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  applyLlm: (settings: LlmSettings) => void
  setRenderer: (r: TownRenderer | null) => void
  setHovered: (id: string | null) => void
  setSelected: (id: string | null) => void
  syncClock: () => void
  markInteracted: () => void
  setDraftText: (text: string) => void
  setSpeaker: (speaker: Speaker) => void
  applyExample: (example: Example) => void
  transmit: () => void
  resetTown: () => void
  toast: (text: string) => void
}

let toastId = 0
const sim = new Simulation()
const initialLlm = loadSettings()
const engine = new ReactionEngine(sim, new DecisionScheduler(...providerFor(initialLlm)))

function providerFor(settings: LlmSettings): [DecisionProvider, number] {
  if (settings.active === 'mock') return [mockProvider, 6]
  const c = settings.connections[settings.active]
  return [createLlmProvider(c), Math.max(1, Math.min(8, c.concurrency))]
}

export const useTown = create<TownState>((set, get) => ({
  sim,
  engine,
  reactions: {},
  complete: false,
  renderer: null,
  ready: false,
  hoveredId: null,
  selectedId: null,
  minutes: 0,
  outside: 0,
  interacted: false,
  draft: { text: '', speaker: { kind: 'mayor' } },
  announcement: null,
  resetting: false,
  toasts: [],
  llm: initialLlm,
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  applyLlm: (llm) => {
    const [provider, concurrency] = providerFor(llm)
    engine.scheduler.provider = provider
    engine.scheduler.concurrency = concurrency
    saveSettings(llm)
    set({ llm })
  },

  setRenderer: (renderer) => set({ renderer, ready: !!renderer }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  syncClock: () => {
    const { sim } = get()
    set({ minutes: Math.floor(sim.minutes), outside: sim.residents.filter((r) => r.mode !== 'inside').length })
  },
  markInteracted: () => get().interacted || set({ interacted: true }),

  setDraftText: (text) => {
    set((s) => ({ draft: { ...s.draft, text: text.slice(0, MAX_ANNOUNCEMENT_LENGTH) } }))
    get().renderer?.markPlace(detectPlace(text))
  },
  setSpeaker: (speaker) => set((s) => ({ draft: { ...s.draft, speaker } })),
  applyExample: (example) => {
    set({ draft: { text: example.text, speaker: example.speaker } })
    get().renderer?.markPlace(detectPlace(example.text))
  },

  transmit: () => {
    const { draft, sim, renderer } = get()
    const text = draft.text.trim()
    if (text.length < 3) return
    const announcement: Announcement = {
      id: crypto.randomUUID(),
      text,
      speaker: draft.speaker,
      place: detectPlace(text),
      minutes: Math.floor(sim.minutes),
    }
    renderer?.markPlace(announcement.place)
    renderer?.select(null)
    renderer?.camera.fit()
    set({ announcement, complete: false, interacted: true })
    engine.start(announcement)
  },

  resetTown: () => {
    if (get().resetting) return
    set({ resetting: true })
    window.setTimeout(() => {
      const { sim, renderer } = get()
      engine.stop()
      sim.reset()
      renderer?.select(null)
      renderer?.markPlace(null)
      renderer?.camera.fit(false)
      set({ announcement: null, reactions: {}, complete: false, draft: { text: '', speaker: { kind: 'mayor' } } })
      get().syncClock()
      window.setTimeout(() => {
        set({ resetting: false })
        get().toast('Pueblo reiniciado. Todos vuelven a su rutina.')
      }, 120)
    }, 320)
  },

  toast: (text) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, text }] }))
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
  },
}))

let flush = 0
const toastedFor = new Set<string>()
engine.on((e) => {
  if (e.type === 'complete' && !toastedFor.has(engine.announcement!.id)) {
    toastedFor.add(engine.announcement!.id)
    useTown.getState().toast('Todo el pueblo ha decidido.')
  }
  if (flush) return
  flush = requestAnimationFrame(() => {
    flush = 0
    const reactions: Record<string, Reaction> = {}
    for (const [id, r] of engine.reactions) reactions[id] = { ...r, rumors: [...r.rumors], told: [...r.told] }
    useTown.setState({ reactions, complete: engine.settled })
  })
})
