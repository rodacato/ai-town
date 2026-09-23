export type SpeakerKind = 'mayor' | 'neighbor' | 'stranger'

export interface Speaker {
  kind: SpeakerKind
  residentId?: string
}

export type AnnouncementPlace =
  | 'plaza'
  | 'fountain'
  | 'cafe'
  | 'bakery'
  | 'shop'
  | 'townhall'
  | 'park'
  | 'riverbank'
  | 'forest'
  | 'field'
  | 'bridge'
  | 'home'

export interface Announcement {
  id: string
  text: string
  speaker: Speaker
  place: AnnouncementPlace | null
  minutes: number
}

const KEYWORDS: [AnnouncementPlace, string[]][] = [
  ['fountain', ['fuente']],
  ['plaza', ['plaza', 'centro del pueblo']],
  ['cafe', ['cafe', 'cafeteria', 'glorieta']],
  ['bakery', ['panaderia', 'pan ']],
  ['shop', ['tienda', 'ferrer']],
  ['townhall', ['ayuntamiento', 'alcaldia']],
  ['park', ['parque']],
  ['bridge', ['puente']],
  ['riverbank', ['rio', 'orilla']],
  ['forest', ['bosque']],
  ['field', ['huerto', 'granja', 'cosecha']],
  ['home', ['casa', 'hogar', 'refugi', 'encierr']],
]

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** The place mentioned earliest in the text wins, so "el puente del río" resolves to the bridge. */
export function detectPlace(text: string): AnnouncementPlace | null {
  const t = ` ${normalize(text)} `
  let best: { place: AnnouncementPlace; index: number } | null = null
  for (const [place, words] of KEYWORDS)
    for (const w of words) {
      const index = t.search(new RegExp(`\\b${w}`))
      if (index >= 0 && (!best || index < best.index)) best = { place, index }
    }
  return best?.place ?? null
}
