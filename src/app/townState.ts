import type { Economy } from '../core/economy/economy'
import type { ChronicleEntry } from '../core/realm/chronicle'
import type { ReignState } from './store/reign'
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
  chronicle?: ChronicleEntry[]
  reign?: ReignState
}

const key = (world: string) => `ai-town:state:${world}`

/** The living town (clock, sky, purses, graves and where everyone is) survives reloads until Reiniciar. */
export function saveTown(world: string, sim: Simulation, chronicle: ChronicleEntry[] = [], reign?: ReignState) {
  const saved: Saved = {
    v: 1,
    minutes: sim.minutes,
    weather: sim.weather,
    season: sim.season,
    economy: sim.economy,
    graves: sim.graves,
    // Someone mid-walk is saved where they stand; they pick their routine up again on load.
    residents: sim.residents.map((r) => ({ id: r.profile.id, x: r.x, y: r.y, mode: r.mode === 'walking' ? 'idle' : r.mode, facing: r.facing })),
    chronicle,
    reign,
  }
  try {
    localStorage.setItem(key(world), JSON.stringify(saved))
  } catch {
    // Storage full or blocked: the town simply starts fresh next time.
  }
}

/** Returns what the app keeps beside the simulation when a town was restored, or null when there was nothing to restore. */
export function restoreTown(world: string, sim: Simulation): { chronicle: ChronicleEntry[]; reign?: ReignState } | null {
  let saved: Saved | null = null
  try {
    saved = JSON.parse(localStorage.getItem(key(world)) ?? 'null') as Saved | null
  } catch {
    return null
  }
  if (saved?.v !== 1) return null
  sim.minutes = saved.minutes
  sim.weather = saved.weather
  sim.season = saved.season
  // Older saves lack newer fields; fresh defaults fill them in.
  if (saved.economy && sim.economy) sim.economy = { ...sim.economy, ...saved.economy, laws: { ...sim.economy.laws, ...saved.economy.laws } }
  for (const s of saved.residents) {
    const r = sim.get(s.id)
    if (!r) continue
    Object.assign(r, { x: s.x, y: s.y, mode: s.mode, facing: s.facing, path: [], tasks: [], timer: 1 + Math.random() * 4 })
  }
  sim.restoreGraves(saved.graves ?? [])
  return { chronicle: saved.chronicle ?? [], reign: saved.reign }
}

export function forgetTown(world: string) {
  try {
    localStorage.removeItem(key(world))
  } catch {
    // Nothing saved, nothing to forget.
  }
}

interface GameFile {
  app: 'ai-town'
  world: string
  state: Saved
  memory: unknown
}

/** The whole game as one file: the town and its memory. */
export function exportGame(world: string): string {
  const read = (k: string) => JSON.parse(localStorage.getItem(k) ?? 'null') as unknown
  const file: GameFile = { app: 'ai-town', world, state: read(key(world)) as Saved, memory: read(`ai-town:memory:${world}`) }
  return JSON.stringify(file)
}

/** Puts a saved game back in storage so the next load picks it up; returns why not, if it cannot. */
export function importGame(world: string, text: string): string | null {
  let file: GameFile
  try {
    file = JSON.parse(text) as GameFile
  } catch {
    return 'El archivo no es una partida válida.'
  }
  if (file?.app !== 'ai-town' || file.state?.v !== 1) return 'El archivo no es una partida de AI Town.'
  if (file.world !== world) return `Esa partida es de otro mundo (${file.world}).`
  try {
    localStorage.setItem(key(world), JSON.stringify(file.state))
    localStorage.setItem(`ai-town:memory:${world}`, JSON.stringify(file.memory ?? { v: 1, entries: [] }))
  } catch {
    return 'No se pudo guardar en este navegador.'
  }
  return null
}
