import type { Announcement } from '../src/core/reactions/announcement'
import { detectPlace } from '../src/core/reactions/announcement'
import type { Example } from '../src/core/world/content'
import { Simulation } from '../src/core/sim/simulation'
import { activeWorld } from '../src/worlds'

export const content = activeWorld.content

export function exampleByTone(tone: Example['tone']) {
  const ex = content.examples.find((e) => e.tone === tone)
  if (!ex) throw new Error(`The active world has no ${tone} example`)
  return ex
}

export function announce(sim: Simulation, ex: Example): Announcement {
  return { id: ex.id, text: ex.text, speaker: ex.speaker, place: detectPlace(ex.text, sim.world.places, content.homeKeywords), minutes: sim.minutes }
}

/** In-memory stand-in for the browser's localStorage, so storage code runs under Node. */
export function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
    dump: () => Object.fromEntries(data),
  }
}
