import type { DecisionContext } from '../decisions/types'
import { buildContext } from '../reactions/context'
import { detectPlace } from '../reactions/announcement'
import { Simulation } from '../sim/simulation'
import type { Example, WorldContent } from '../world/content'

/** Seconds of town life before the announcement, so residents are mid-routine rather than at their spawn points. */
const WARMUP_SECONDS = 40
const STEP = 1 / 30

export interface Scenario {
  id: string
  text: string
  tone: Example['tone']
  /** One context per resident who is not the speaker: the first reaction, without word of mouth. */
  contexts: DecisionContext[]
}

/** The same seed always gives the same town, the same moment and therefore the same prompts. */
export function buildScenario(content: WorldContent, example: Example, seed: number): Scenario {
  const sim = new Simulation(content, seed)
  for (let t = 0; t < WARMUP_SECONDS; t += STEP) sim.update(STEP)
  const announcement = {
    id: example.id,
    text: example.text,
    speaker: example.speaker,
    place: detectPlace(example.text, sim.world.places, content.homeKeywords),
    minutes: sim.minutes,
  }
  const speakerId = example.speaker.kind === 'neighbor' ? example.speaker.residentId : null
  return {
    id: example.id,
    text: example.text,
    tone: example.tone,
    contexts: sim.residents.filter((r) => r.profile.id !== speakerId).map((r) => buildContext(sim, announcement, r, [], null)),
  }
}
