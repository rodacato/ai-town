import { PLACE_LABEL, speakerName } from '../../worlds/serena/announcements'
import { RESIDENTS } from '../../worlds/serena/residents'
import type { Announcement } from './announcement'
import { formatClock } from '../sim/clock'
import type { Resident } from '../sim/simulation'
import { statusOf } from '../sim/status'
import type { Decision, DecisionContext, Rumor } from '../decisions/types'

export function buildContext(
  a: Announcement,
  r: Resident,
  minutes: number,
  rumors: Rumor[],
  previous: Decision | null,
): DecisionContext {
  const p = r.profile
  const nameOf = (id: string) => RESIDENTS.find((x) => x.id === id)?.name ?? id
  return {
    resident: { id: p.id, name: p.name, age: p.age, occupation: p.occupation, bio: p.bio, traits: p.traits },
    relationships: p.relationships.map((rel) => ({ id: rel.id, name: nameOf(rel.id), label: rel.label })),
    announcement: {
      id: a.id,
      text: a.text,
      speakerKind: a.speaker.kind,
      speakerName: speakerName(a.speaker),
      relationToSpeaker: a.speaker.kind === 'neighbor' ? (p.relationships.find((rel) => rel.id === a.speaker.residentId)?.label ?? null) : null,
      place: a.place,
      placeLabel: a.place ? PLACE_LABEL[a.place] : null,
    },
    situation: { activity: statusOf(r), time: `${formatClock(minutes).day} ${formatClock(minutes).time}` },
    rumors,
    previous,
    townsfolk: RESIDENTS.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name })),
  }
}
