import type { Announcement } from '../reactions/announcement'
import { ago, type TownMemory } from './memory'

/** What a resident remembers that bears on a new announcement, in their own terms, for the prompt and the rules. */
export interface Recall {
  /** The speaker's record with the town, if they have one. */
  record: string | null
  /** How it went for this resident the last time this speaker spoke. */
  personal: string | null
  /** A few recent happenings, oldest first. */
  recent: string[]
  /** 0–1 trust the town has in this speaker, with how much it is based on. */
  trust: number
  judged: number
  /** -1 fooled last time, 1 rightly doubted or rightly believed, 0 no memory. */
  lesson: -1 | 0 | 1
}

export function recallFor(memory: TownMemory, a: Announcement, residentId: string, speakerName: string): Recall {
  const rep = memory.reputation(a.speaker)
  const judged = rep.truths + rep.lies
  const sight = a.speaker.kind === 'sight'
  const said = judged ? `${speakerName} ha anunciado ${judged} ${judged === 1 ? 'cosa' : 'cosas'} antes: ${rep.truths} ${rep.truths === 1 ? 'resultó verdad' : 'resultaron verdad'} y ${rep.lies} ${rep.lies === 1 ? 'mentira' : 'mentiras'}.` : ''
  const deeds = rep.good + rep.bad ? `Cuando hubo peligro, su guardia protegió al pueblo ${rep.good} ${rep.good === 1 ? 'vez' : 'veces'} y le falló ${rep.bad}.` : ''
  const record = sight || !(said || deeds) ? null : [said, deeds].filter(Boolean).join(' ')
  const last = sight ? null : memory.lastWith(a.speaker, residentId)
  let personal: string | null = null
  let lesson: Recall['lesson'] = 0
  if (last && last.believed !== null) {
    const when = ago(a.minutes, last.entry.minutes)
    const right = last.believed === last.entry.truth
    lesson = right ? 1 : -1
    personal = last.believed
      ? `La última vez (${when}) le creíste, y ${last.entry.truth ? 'era verdad' : 'era mentira: te engañó'}.`
      : `La última vez (${when}) no le creíste, y ${last.entry.truth ? 'resultó ser verdad' : 'hiciste bien: era mentira'}.`
  }
  const recent = memory.recent(a.minutes).map((e) => `${ago(a.minutes, e.minutes)}: ${e.summary}`)
  return { record, personal, recent, trust: rep.trust, judged, lesson }
}
