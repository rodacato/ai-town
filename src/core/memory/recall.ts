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
  /** Times this speaker has fooled this resident. */
  fooled: number
  /** Neighbors who passed this resident a lie they believed, most times first. */
  grudges: Kept[]
  /** Neighbors who warned this resident in time of something true: the ones they owe. */
  debts: Kept[]
}

export interface Kept {
  id: string
  name: string
  times: number
}

const PEOPLE_KEPT = 3

function kept(bonds: [string, number][], nameOf: (id: string) => string): Kept[] {
  return bonds
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, PEOPLE_KEPT)
    .map(([id, times]) => ({ id, name: nameOf(id), times }))
}

const timesText = (n: number) => (n === 1 ? 'una vez' : `${n} veces`)

/** The personal side of memory in words: who a resident holds a grudge against and who they owe. */
export function bondLines(m: Pick<Recall, 'grudges' | 'debts'>): string[] {
  const list = (xs: Kept[]) => xs.map((x) => `${x.name} (${timesText(x.times)})`).join(', ')
  return [
    ...(m.grudges.length ? [`Te pasaron mentiras que te creíste: ${list(m.grudges)}.`] : []),
    ...(m.debts.length ? [`Te avisaron a tiempo de algo cierto, y se lo debes: ${list(m.debts)}.`] : []),
  ]
}

export function recallFor(memory: TownMemory, a: Announcement, residentId: string, speakerName: string, nameOf: (id: string) => string = (id) => id): Recall {
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
  const fooled = sight ? 0 : memory.fooled(a.speaker, residentId)
  if (personal && fooled >= 2) personal += ` Ya te ha engañado ${fooled} veces.`
  const bonds = [...memory.bondsOf(residentId)]
  const recent = memory.recent(a.minutes).map((e) => `${ago(a.minutes, e.minutes)}: ${e.summary}`)
  return {
    record,
    personal,
    recent,
    trust: rep.trust,
    judged,
    lesson,
    fooled,
    grudges: kept(bonds.map(([id, b]) => [id, b.misled]), nameOf),
    debts: kept(bonds.map(([id, b]) => [id, b.warned]), nameOf),
  }
}
