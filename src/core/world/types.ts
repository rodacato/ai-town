export interface Point {
  x: number
  y: number
}

export type TileKind = 'grass' | 'path' | 'plaza' | 'water' | 'bridge' | 'field' | 'sand'

export interface Tile {
  kind: TileKind
  /** Decoration drawn by the world's art kit; blocking ones also set `blocked`. */
  prop?: string
  /** Footprint of a building, a landmark or a solid prop. */
  blocked: boolean
  buildingId?: string
}

export interface Building {
  id: string
  /** Art kit key, e.g. 'house' or 'tavern'. */
  kind: string
  name: string
  x: number
  y: number
  /** Buildings are square so depth sorting against residents stays exact. */
  size: number
  /** Face that holds the door: 'left' = +y face, 'right' = +x face (both face the viewer). */
  doorSide: 'left' | 'right'
  /** Walkable tile just outside the door. */
  door: Point
  palette: number
}

export interface Landmark {
  id: string
  kind: string
  x: number
  y: number
  size: number
}

export interface Place {
  id: string
  name: string
  keywords: string[]
  /** Tiles where a resident can stand when visiting this place. */
  spots: Point[]
}
