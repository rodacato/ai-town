import type { Rng } from './rng'
import type { Building, Point, Tile, TileKind } from './types'
import type { World } from './world'

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface Look {
  skin: number
  hair: number
  hairStyle: string
  shirt: number
  pants: number
  accessory?: string
  /** Body type the sprite adapts to, e.g. 'human', 'elf', 'dwarf', 'halfling', 'gnome', 'halforc', 'tiefling'. */
  ancestry?: string
  beard?: number
}

export interface ResidentProfile {
  id: string
  name: string
  age: number
  occupation: string
  bio: string
  traits: string[]
  /** Moral compass in D&D terms ("legal bueno", "caótico neutral"…); both providers weigh it when present. */
  alignment?: string
  relationships: { id: string; label: string }[]
  home: string
  /** Weights over place ids, plus the special keys 'home' and 'visit'. */
  routine: Record<string, number>
  look: Look
}

export type SpeakerKind = 'authority' | 'neighbor' | 'stranger'

export interface SpeakerDef {
  label: string
  hint: string
  /** How the speaker is named in the UI and in prompts, e.g. "Ramiro Ibáñez, alcalde". */
  name: string
}

/** Helpers the layout's decorate() hook uses to scatter trees, flowers and the like. */
export interface LayoutTools {
  size: number
  rng: Rng
  at: (x: number, y: number) => Tile | undefined
  setKind: (x: number, y: number, kind: TileKind) => void
  setProp: (x: number, y: number, prop: string) => void
  nearPaved: (x: number, y: number, radius: number) => boolean
  adjacentTo: (x: number, y: number, pred: (t: Tile) => boolean) => boolean
  inRect: (x: number, y: number, r: Rect) => boolean
}

export interface WorldLayout {
  size: number
  seed: number
  river?: { x: (y: number) => number; width: number }
  roads: [number, number, number, number][]
  areas: { kind: TileKind; rect: Rect; prop?: { name: string; every: 'row' | 'tile' } }[]
  /** Solid decorative structures the art draws specially, e.g. a fountain or a statue. */
  landmarks: { id: string; kind: string; x: number; y: number; size: number }[]
  buildings: Omit<Building, 'door'>[]
  props: { kind: string; x: number; y: number }[]
  blockingProps: string[]
  decorate?: (tools: LayoutTools) => void
}

export interface PlaceQuery {
  world: World
  /** Walkable tiles reachable from the town's gathering place. */
  walkable: Point[]
  where: (pred: (p: Point, t: Tile) => boolean) => Point[]
  aroundDoor: (buildingId: string, radius: number) => Point[]
  inRect: (r: Rect) => Point[]
}

export interface PlaceDef {
  id: string
  /** With article, as used in sentences: "la plaza", "el puente". */
  name: string
  /** Words that make an announcement point at this place; matched accent- and case-insensitively. */
  keywords?: string[]
  spots: (q: PlaceQuery) => Point[]
}

export interface Example {
  id: string
  tone: 'confiable' | 'urgente' | 'sospechoso' | 'emergencia'
  speaker: { kind: SpeakerKind; residentId?: string }
  text: string
}

export interface WorldContent {
  id: string
  name: string
  tagline: string
  layout: WorldLayout
  places: PlaceDef[]
  /** Where residents gather by default and where the announcement falls back to. */
  gatheringPlace: string
  homeLabel: string
  homeKeywords: string[]
  residents: ResidentProfile[]
  speakers: Record<SpeakerKind, SpeakerDef>
  authorityOrigin: { building: string }
  strangerOrigin: Point
  examples: Example[]
  /** Vocabulary the rule-based provider reads announcements with. */
  vocabulary: {
    opportunity: string[]
    danger: string[]
    cues: [needle: string, label: string][]
  }
  /** One paragraph that sets the scene for an LLM playing a resident. */
  promptSetting: string
  copy: {
    composerTitle: string
    composerSubtitle: string
    broadcast: string
    onAir: string
    /** Masculine noun for one announcement, e.g. "anuncio" or "pregón". */
    noun: string
    emptyHint: string
  }
}
