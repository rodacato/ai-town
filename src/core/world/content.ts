import type { EconomyRules } from '../economy/economy'
import type { RealmDef } from '../realm/realmDef'
import type { OutcomeDef, OutcomeVisual } from '../reactions/outcome'
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

/** Each 0–1; the rules mode decides from them and the benchmark checks models against them. */
export interface PersonalityScales {
  /** How readily they believe what they hear. */
  credulity: number
  /** Whether they walk towards danger or away from it. */
  bravery: number
  /** How much they seek company and pass news on. */
  sociability: number
  /** How much weight an official order carries. */
  authority: number
  /** How strongly gain pulls on them. */
  greed: number
}

export const SCALES: (keyof PersonalityScales)[] = ['credulity', 'bravery', 'sociability', 'authority', 'greed']

export interface Personality {
  /** How they talk, so replies sound like them. */
  voice: string
  values: string[]
  fears: string[]
  /** Something nobody else in town knows. */
  secret: string
  scales: PersonalityScales
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
  personality: Personality
  relationships: { id: string; label: string }[]
  home: string
  /** Weights over place ids, plus the special keys 'home' and 'visit'. */
  routine: Record<string, number>
  /** Where they go between 22:00 and 6:00; without one they sleep at home. */
  nightRoutine?: Record<string, number>
  look: Look
}

/** 'sight' is no speaker at all: residents see the thing happen with their own eyes. */
export type SpeakerKind = 'authority' | 'neighbor' | 'stranger' | 'sight'

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

/** Someone who stands guard and never takes part: not a resident, never asked to decide. */
export interface Sentry {
  x: number
  y: number
  /** 1 faces screen-right, -1 screen-left. */
  facing: 1 | -1
  look: Look
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
  sentries?: Sentry[]
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
  /** Has a roof, so people still go there in foul weather and winter. */
  indoors?: boolean
  /** Busier in the evening, like a tavern. */
  lively?: boolean
  /** A place people sit a good while, like a bench or a riverbank. */
  linger?: boolean
}

/** Where a kind of event happens in this world; with a line for the chronicle, fate can bring it too. */
export interface Hazard {
  visual: OutcomeVisual
  place: string
  fate?: string
}

export interface Example {
  id: string
  tone: 'confiable' | 'urgente' | 'sospechoso' | 'emergencia'
  speaker: { kind: SpeakerKind; residentId?: string }
  text: string
  /** Whether it is true in this world's story; the benchmark scores beliefs against it. */
  truth?: boolean
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
  /** Where each kind of event strikes, for fate, random events and the god panel. */
  hazards: Hazard[]
  /** The place where graves are dug, if the world has one. */
  graveyard?: string
  /** The place people walk to when they leave town. */
  exit?: string
  /** How the town earns, eats and pays; without it the world has no economy. */
  economy?: EconomyRules
  /** Who rules and who plots; worlds with an economy have one. */
  realm?: RealmDef
  /** What announcements turn into when they come true, matched by keyword. */
  outcomes?: OutcomeDef[]
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
