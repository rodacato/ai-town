import type { Decision, DecisionContext, Rumor } from '../decisions/types'
import { formatClock } from '../sim/clock'
import type { Resident, Simulation } from '../sim/simulation'
import { statusOf } from '../sim/status'
import { SEASON_TEXT } from '../sim/season'
import { WEATHER_TEXT } from '../sim/weather'
import { placeLabel, speakerName, type Announcement } from './announcement'
import type { TownMemory } from '../memory/memory'
import { recallFor } from '../memory/recall'
import { livingRelations } from '../memory/bonds'

export function buildContext(sim: Simulation, a: Announcement, r: Resident, rumors: Rumor[], previous: Decision | null, memory?: TownMemory): DecisionContext {
  const { content } = sim
  const p = r.profile
  const nameOf = (id: string) => content.residents.find((x) => x.id === id)?.name ?? id
  const clock = formatClock(sim.minutes)
  const bonds = memory?.bondsOf(p.id)
  const relations = bonds ? livingRelations(p.relationships, bonds) : p.relationships
  return {
    world: { name: content.name, setting: content.promptSetting },
    resident: { id: p.id, name: p.name, age: p.age, occupation: p.occupation, bio: p.bio, traits: p.traits, alignment: p.alignment, ancestry: p.look.ancestry, personality: p.personality },
    relationships: relations.map((rel) => ({ id: rel.id, name: nameOf(rel.id), label: rel.label })),
    announcement: {
      id: a.id,
      text: a.text,
      speakerKind: a.speaker.kind,
      speakerName: speakerName(content, a.speaker),
      relationToSpeaker: a.speaker.kind === 'neighbor' ? (relations.find((rel) => rel.id === a.speaker.residentId)?.label ?? null) : null,
      place: a.place,
      placeLabel: placeLabel(content, a.place),
    },
    situation: { activity: statusOf(sim, r), time: `${clock.day} ${clock.time}`, season: SEASON_TEXT[sim.season].sentence, weather: WEATHER_TEXT[sim.weather].sentence, ...needsOf(sim, p.id) },
    rumors: bonds ? withBonds(rumors, bonds) : rumors,
    previous,
    townsfolk: content.residents.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name })),
    ...(memory ? { memory: recallFor(memory, a, p.id, speakerName(content, a.speaker), nameOf) } : {}),
  }
}

function withBonds(rumors: Rumor[], bonds: ReturnType<TownMemory['bondsOf']>): Rumor[] {
  return rumors.map((r) => {
    const b = bonds.get(r.fromId)
    return b ? { ...r, ...(b.misled ? { misled: b.misled } : {}), ...(b.warned ? { warned: b.warned } : {}) } : r
  })
}

/** A resident's hunger and purse, only when they are worth mentioning, so a fresh town reads as before. */
function needsOf(sim: Simulation, id: string) {
  const e = sim.economy
  const n = e?.needs[id]
  if (!e || !n) return {}
  const coins = e.purses[id] ?? 0
  const broke = coins < e.foodPrice
  if (!n.daysHungry && n.status !== 'sick' && !broke) return {}
  return { needs: { daysHungry: n.daysHungry, sick: n.status === 'sick', coins, broke } }
}
