import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { Outcome } from '../../core/reactions/outcome'
import type { Weather } from '../../core/sim/weather'

/** The god panel: direct control over time, weather and events, for trying things out on the spot. */
export interface GodSlice {
  godOpen: boolean
  /** Simulation speed; 0 pauses the town (model requests keep going). */
  speed: number
  weather: Weather
  /** An event unleashed from the panel, independent of any announcement. */
  godEvent: Outcome | null
  curfew: boolean
  setGodOpen: (open: boolean) => void
}

export const createGodSlice: StateCreator<TownState, [], [], GodSlice> = (set) => ({
  godOpen: false,
  speed: 1,
  weather: 'clear',
  godEvent: null,
  curfew: false,
  setGodOpen: (godOpen) => set({ godOpen }),
})
