import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { MemoryEntry } from '../../core/memory/memory'
import type { Outcome } from '../../core/reactions/outcome'
import type { Season } from '../../core/sim/season'
import type { Weather } from '../../core/sim/weather'

/** The god panel: direct control over time, weather and events, for trying things out on the spot. */
export interface GodSlice {
  godOpen: boolean
  /** Simulation speed; 0 pauses the town (model requests keep going). */
  speed: number
  weather: Weather
  season: Season
  /** An event unleashed from the panel, independent of any announcement. */
  godEvent: Outcome | null
  curfew: boolean
  /** Snapshot of the town's memory, refreshed whenever it records something. */
  memoryEntries: MemoryEntry[]
  setGodOpen: (open: boolean) => void
}

export const createGodSlice: StateCreator<TownState, [], [], GodSlice> = (set) => ({
  godOpen: false,
  speed: 1,
  weather: 'clear',
  season: 'summer',
  godEvent: null,
  curfew: false,
  memoryEntries: [],
  setGodOpen: (godOpen) => set({ godOpen }),
})
