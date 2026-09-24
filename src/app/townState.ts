import type { Economy } from '../core/economy/economy'
import type { Season } from '../core/sim/season'
import type { ResidentMode, Simulation } from '../core/sim/simulation'
import type { Weather } from '../core/sim/weather'
import type { Point } from '../core/world/types'

interface Saved {
  v: 1
  minutes: number
  weather: Weather
  season: Season
  economy: Economy | null
  graves: Point[]
  residents: { id: string; x: number; y: number; mode: ResidentMode; facing: 1 | -1 }[]
}

const key = (world: string) => `ai-town:state:${world}`

/** The living town (clock, sky, purses, graves and where everyone is) survives reloads until Reiniciar. */
export function saveTown(world: string, sim: Simulation) {
  const saved: Saved = {
    v: 1,
    minutes: sim.minutes,
    weather: sim.weather,
    season: sim.season,
    economy: sim.economy,
    graves: sim.graves,
    // Someone mid-walk is saved where they stand; they pick their routine up again on load.
    residents: sim.residents.map((r) => ({ id: r.profile.id, x: r.x, y: r.y, mode: r.mode === 'walking' ? 'idle' : r.mode, facing: r.facing })),
  }
  try {
    localStorage.setItem(key(world), JSON.stringify(saved))
  } catch {
    // Storage full or blocked: the town simply starts fresh next time.
  }
}

/** Returns whether a saved town was restored. */
export function restoreTown(world: string, sim: Simulation) {
  let saved: Saved | null = null
  try {
    saved = JSON.parse(localStorage.getItem(key(world)) ?? 'null') as Saved | null
  } catch {
    return false
  }
  if (saved?.v !== 1) return false
  sim.minutes = saved.minutes
  sim.weather = saved.weather
  sim.season = saved.season
  if (saved.economy && sim.economy) sim.economy = saved.economy
  for (const s of saved.residents) {
    const r = sim.get(s.id)
    if (!r) continue
    Object.assign(r, { x: s.x, y: s.y, mode: s.mode, facing: s.facing, path: [], tasks: [], timer: 1 + Math.random() * 4 })
  }
  sim.restoreGraves(saved.graves ?? [])
  return true
}

export function forgetTown(world: string) {
  try {
    localStorage.removeItem(key(world))
  } catch {
    // Nothing saved, nothing to forget.
  }
}
