import type { Speaker } from '../reactions/announcement'

/** One thing the town lived through. */
export interface MemoryEntry {
  id: string
  /** Game clock when it happened. */
  minutes: number
  text: string
  speaker: Speaker
  /** Set once the town saw whether it was true; sightings are always true. */
  truth?: boolean
  /** Short line for recalling it later, e.g. "el dragón incendió el Bosque Susurrante". */
  summary: string
  believers: string[]
  doubters: string[]
  /** Who passed the news to whom, so each resident remembers who misled or warned them. */
  told?: { from: string; to: string }[]
  /** Something the speaker did rather than said, like the guard stopping thieves or not: weighs on trust, never counts as a lie. */
  deed?: boolean
}

/** What one resident holds against, or owes, another. */
export interface Bond {
  /** Times they passed on something this resident believed and that turned out false. */
  misled: number
  /** Times they warned this resident, in time, of something true. */
  warned: number
}

export interface Reputation {
  truths: number
  lies: number
  /** Deeds that protected the town, and ones that failed it. */
  good: number
  bad: number
  /** 0–1, starting at one half with no record and moving with every revealed announcement. */
  trust: number
}

const speakerKey = (s: Speaker) => (s.kind === 'neighbor' ? `neighbor:${s.residentId}` : s.kind)

const DAYS_KEPT = 30
const RECENT = 3

/** What the town remembers across announcements: who told the truth, who lied, and what happened. */
export class TownMemory {
  constructor(public entries: MemoryEntry[] = []) {}

  record(entry: MemoryEntry) {
    this.entries = [...this.entries.filter((e) => e.id !== entry.id), entry]
      .filter((e) => entry.minutes - e.minutes <= DAYS_KEPT * 1440)
      .sort((a, b) => a.minutes - b.minutes)
  }

  clear() {
    this.entries = []
  }

  reputation(speaker: Speaker): Reputation {
    const key = speakerKey(speaker)
    const judged = this.entries.filter((e) => e.speaker.kind !== 'sight' && speakerKey(e.speaker) === key && e.truth !== undefined)
    const said = judged.filter((e) => !e.deed)
    const deeds = judged.filter((e) => e.deed)
    const truths = said.filter((e) => e.truth).length
    const good = deeds.filter((e) => e.truth).length
    // A deed weighs half a word: the guard doing its job should not outweigh what the Baroness says.
    return { truths, lies: said.length - truths, good, bad: deeds.length - good, trust: (truths + good / 2 + 1) / (said.length + deeds.length / 2 + 2) }
  }

  /** Last announcement by this speaker whose truth came out, from this resident's point of view. */
  lastWith(speaker: Speaker, residentId: string) {
    const key = speakerKey(speaker)
    const last = [...this.entries].reverse().find((e) => e.speaker.kind !== 'sight' && !e.deed && speakerKey(e.speaker) === key && e.truth !== undefined)
    if (!last) return null
    const believed = last.believers.includes(residentId) ? true : last.doubters.includes(residentId) ? false : null
    return { entry: last, believed }
  }

  /** Times this speaker's announcements fooled this resident: they believed and it was a lie. */
  fooled(speaker: Speaker, residentId: string) {
    const key = speakerKey(speaker)
    return this.entries.filter((e) => e.speaker.kind !== 'sight' && !e.deed && speakerKey(e.speaker) === key && e.truth === false && e.believers.includes(residentId)).length
  }

  /** Every speaker whose announcements fooled this resident, with how many times. */
  foolers(residentId: string): { speaker: Speaker; times: number }[] {
    const by = new Map<string, { speaker: Speaker; times: number }>()
    for (const e of this.entries) {
      if (e.speaker.kind === 'sight' || e.deed || e.truth !== false || !e.believers.includes(residentId)) continue
      const key = speakerKey(e.speaker)
      const f = by.get(key) ?? { speaker: e.speaker, times: 0 }
      f.times++
      by.set(key, f)
    }
    return [...by.values()].sort((a, b) => b.times - a.times)
  }

  /** Everyone who has misled or warned this resident by word of mouth, whether or not they meant to. */
  bondsOf(residentId: string): Map<string, Bond> {
    const bonds = new Map<string, Bond>()
    for (const e of this.entries) {
      if (e.truth === undefined || !e.believers.includes(residentId)) continue
      for (const t of e.told ?? []) {
        if (t.to !== residentId || t.from === residentId) continue
        const b = bonds.get(t.from) ?? { misled: 0, warned: 0 }
        if (e.truth) b.warned++
        else b.misled++
        bonds.set(t.from, b)
      }
    }
    return bonds
  }

  recent(now: number, n = RECENT) {
    return this.entries.filter((e) => e.minutes <= now).slice(-n)
  }
}

export function ago(now: number, then: number) {
  const days = Math.floor(now / 1440) - Math.floor(then / 1440)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}
