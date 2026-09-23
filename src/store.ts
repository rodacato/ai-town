import { create } from 'zustand'
import type { TownRenderer } from './render/TownRenderer'
import { Simulation } from './sim/simulation'

interface TownState {
  sim: Simulation
  renderer: TownRenderer | null
  ready: boolean
  hoveredId: string | null
  selectedId: string | null
  minutes: number
  outside: number
  interacted: boolean
  setRenderer: (r: TownRenderer | null) => void
  setHovered: (id: string | null) => void
  setSelected: (id: string | null) => void
  syncClock: () => void
  markInteracted: () => void
}

export const useTown = create<TownState>((set, get) => ({
  sim: new Simulation(),
  renderer: null,
  ready: false,
  hoveredId: null,
  selectedId: null,
  minutes: 0,
  outside: 0,
  interacted: false,
  setRenderer: (renderer) => set({ renderer, ready: !!renderer }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  syncClock: () => {
    const { sim } = get()
    set({ minutes: Math.floor(sim.minutes), outside: sim.residents.filter((r) => r.mode !== 'inside').length })
  },
  markInteracted: () => get().interacted || set({ interacted: true }),
}))
