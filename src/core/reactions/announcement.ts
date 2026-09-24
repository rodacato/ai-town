import type { SpeakerKind, WorldContent } from '../world/content'
import type { Place } from '../world/types'

export type { SpeakerKind }

export interface Speaker {
  kind: SpeakerKind
  residentId?: string
}

export interface Announcement {
  id: string
  text: string
  speaker: Speaker
  /** A place id, 'home' when it asks people to stay in, or null when it names no place. */
  place: string | null
  minutes: number
  /** Whether it turns out to be true; residents never see it, the engine reveals it once they have decided. */
  truth?: boolean
}

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** The place mentioned earliest in the text wins, so "el puente del río" resolves to the bridge. */
export function detectPlace(text: string, places: Place[], homeKeywords: string[]): string | null {
  const t = ` ${normalize(text)} `
  let best: { place: string; index: number } | null = null
  const candidates: [string, string[]][] = [...places.map((p): [string, string[]] => [p.id, p.keywords]), ['home', homeKeywords]]
  for (const [place, words] of candidates)
    for (const w of words) {
      const index = t.search(new RegExp(`\\b${normalize(w)}`))
      if (index >= 0 && (!best || index < best.index)) best = { place, index }
    }
  return best?.place ?? null
}

export function placeLabel(content: WorldContent, place: string | null) {
  if (!place) return null
  if (place === 'home') return content.homeLabel
  return content.places.find((p) => p.id === place)?.name ?? null
}

export function speakerName(content: WorldContent, speaker: Speaker) {
  if (speaker.kind !== 'neighbor') return content.speakers[speaker.kind].name
  const r = content.residents.find((p) => p.id === speaker.residentId)
  return r ? `${r.name}, vecino` : content.speakers.neighbor.name
}
