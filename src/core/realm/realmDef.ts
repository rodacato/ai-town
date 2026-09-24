import type { PetitionTopic } from './petitions'

/** What a world's realm is called and who plays each part in it: the ruler, the threat from outside and those who petition. */
export interface RealmDef {
  ruler: {
    /** Bare title, for labels: "Baronesa". */
    short: string
    /** With article, for sentences: "la Baronesa". */
    title: string
    /** Full name with article: "la Baronesa Isolda". */
    name: string
    /** How her subjects address her: "mi señora". */
    address: string
    /** Where she sits and the coffers are kept, with article: "el castillo". */
    seat: string
  }
  /** The band from outside that plots against the treasury, and the resident whose debt draws it. */
  guild: { name: string; debtor: string }
  /** Who speaks for each grievance at dawn. */
  petitioners: Partial<Record<PetitionTopic, string>>
  /** Where festivals are held, with article: "la Plaza del Pregón". */
  festivalPlace: string
}

/** The first letter up, for a sentence that opens with a title. */
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "de" and "a" before a title, contracted as Spanish asks: "del Alcalde", "al Alcalde". */
export const ofThe = (title: string) => (title.startsWith('el ') ? `del ${title.slice(3)}` : `de ${title}`)
export const toThe = (title: string) => (title.startsWith('el ') ? `al ${title.slice(3)}` : `a ${title}`)
