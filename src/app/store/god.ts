import type { StateCreator } from 'zustand'
import type { TownState } from '.'
import type { MemoryEntry } from '../../core/memory/memory'
import type { ChronicleEntry } from '../../core/realm/chronicle'
import type { Outcome } from '../../core/reactions/outcome'
import type { Season } from '../../core/sim/season'
import type { Weather } from '../../core/sim/weather'

/** The god panel: direct control over time, weather and events, for trying things out on the spot. */
export interface Realm {
  day: number
  treasury: number
  granary: number
  foodDays: number
  mood: number
  taxRate: number
  foodPrice: number
  hungry: number
  gone: string[]
  dead: string[]
  /** Per resident: hunger, health, mood and coins, for the inspector. */
  people: Record<string, { status: string; daysHungry: number; health: number; mood: number; coins: number }>
}

export interface GodSlice {
  godOpen: boolean
  /** Simulation speed; 0 pauses the town (model requests keep going). */
  speed: number
  weather: Weather
  season: Season
  /** An event unleashed from the panel, independent of any announcement. */
  godEvent: Outcome | null
  /** The realm at a glance, refreshed at every dawn and after anything that moves it. */
  realm: Realm | null
  /** Snapshot of the town's memory, refreshed whenever it records something. */
  memoryEntries: MemoryEntry[]
  /** The latest chronicle lines, oldest first. */
  chronicle: ChronicleEntry[]
  throneOpen: boolean
  chronicleOpen: boolean
  activityOpen: boolean
  /** The announcement panel; folds away while a drawer is open, and closes the drawers when it opens. */
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  setThroneOpen: (open: boolean) => void
  setGodOpen: (open: boolean) => void
}

export const createGodSlice: StateCreator<TownState, [], [], GodSlice> = (set) => ({
  godOpen: false,
  speed: 2,
  weather: 'clear',
  season: 'summer',
  godEvent: null,
  realm: null,
  memoryEntries: [],
  chronicle: [],
  throneOpen: false,
  chronicleOpen: false,
  activityOpen: false,
  panelOpen: true,
  setPanelOpen: (panelOpen) => set(panelOpen ? { panelOpen, godOpen: false, throneOpen: false } : { panelOpen }),
  setThroneOpen: (throneOpen) => set(throneOpen ? { throneOpen, godOpen: false, panelOpen: false } : { throneOpen }),
  setGodOpen: (godOpen) => set(godOpen ? { godOpen, throneOpen: false, panelOpen: false } : { godOpen }),
})
