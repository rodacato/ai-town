export type ChronicleKind = 'dawn' | 'decree' | 'event' | 'reveal' | 'death' | 'leave' | 'ruler' | 'petition' | 'plot' | 'end'

export interface ChronicleEntry {
  minutes: number
  kind: ChronicleKind
  text: string
}

const KEEP = 600

/** The realm's logbook: what happened and when, oldest first, for the reader and for whoever rules. */
export class Chronicle {
  constructor(public entries: ChronicleEntry[] = []) {}

  add(minutes: number, kind: ChronicleKind, text: string) {
    this.entries.push({ minutes, kind, text })
    if (this.entries.length > KEEP) this.entries.splice(0, this.entries.length - KEEP)
  }

  since(minutes: number) {
    return this.entries.filter((e) => e.minutes >= minutes)
  }

  clear() {
    this.entries = []
  }
}
