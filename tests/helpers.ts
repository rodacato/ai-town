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
