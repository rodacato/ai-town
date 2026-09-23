import type { Container } from 'pixi.js'
import type { Building, Landmark } from '../core/world/types'

export interface TerrainPalette {
  grass: readonly number[]
  grassDark: number
  grassTuft: number
  path: readonly number[]
  pathEdge: number
  pebble: number
  plaza: readonly number[]
  plazaLine: number
  water: number
  waterDeep: number
  waterFoam: number
  bridge: number
  bridgePlank: number
  railing: number
  field: number
  fieldRow: number
  sideLeft: number
  sideRight: number
  sideRock: number
}

export interface ArtSprite {
  view: Container
  /** Sort key: tiles further down-screen (larger x + y) draw on top. */
  depth: number
  update?: (time: number, dt: number) => void
}

export interface BuildingSprite extends ArtSprite {
  /** Screen points where chimney smoke starts. */
  chimneys: { x: number; y: number }[]
}

export interface PropSprite extends ArtSprite {
  /** Part that sways in the wind, like a tree crown. */
  sway?: { target: Container; phase: number; amount: number }
}

/** Everything a world draws in its own style; the renderer handles layout, depth, residents and effects. */
export interface WorldArt {
  terrain: TerrainPalette
  building: (b: Building) => BuildingSprite
  prop: (kind: string, x: number, y: number) => PropSprite | null
  landmark: (l: Landmark) => ArtSprite
  /** The hooded figure standing where a stranger makes an announcement. */
  stranger: () => Container
}
