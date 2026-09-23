export interface Point {
  x: number
  y: number
}

export type TileKind = 'grass' | 'path' | 'plaza' | 'water' | 'bridge' | 'field' | 'sand'

export type PropKind =
  | 'tree'
  | 'pine'
  | 'bush'
  | 'bench'
  | 'lamp'
  | 'flowers'
  | 'rock'
  | 'crop'
  | 'stall'
  | 'well'
  | 'fence'
  | 'reeds'

export interface Tile {
  kind: TileKind
  prop?: PropKind
  /** Footprint of a building or a solid prop. */
  blocked: boolean
  buildingId?: string
}

export type BuildingKind = 'house' | 'townhall' | 'cafe' | 'bakery' | 'shop' | 'cabin'

export interface Building {
  id: string
  kind: BuildingKind
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

export type PlaceKind =
  | 'plaza'
  | 'fountain'
  | 'bench'
  | 'cafe'
  | 'bakery'
  | 'shop'
  | 'townhall'
  | 'park'
  | 'riverbank'
  | 'forest'
  | 'field'
  | 'bridge'
  | 'street'

export interface Place {
  id: string
  name: string
  kind: PlaceKind
  /** Tiles where a resident can stand when visiting this place. */
  spots: Point[]
}
