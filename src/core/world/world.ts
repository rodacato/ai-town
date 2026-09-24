import type { LayoutTools, PlaceQuery, Sentry, WorldContent } from './content'
import { createRng } from './rng'
import type { Building, Landmark, Place, Point, Tile, TileKind } from './types'

export interface World {
  size: number
  tiles: Tile[][]
  buildings: Building[]
  landmarks: Landmark[]
  sentries: Sentry[]
  places: Place[]
}

const PAVED = new Set<TileKind>(['path', 'plaza', 'bridge'])
const DIRS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function isWalkable(t: Tile | undefined) {
  return !!t && !t.blocked && t.kind !== 'water'
}

export function tileCost(t: Tile) {
  if (t.prop === 'bench') return 4
  if (PAVED.has(t.kind)) return 1
  return t.kind === 'field' ? 3 : 2.2
}

export function createWorld(content: WorldContent): World {
  const L = content.layout
  const N = L.size
  const rng = createRng(L.seed)
  const blocking = new Set(L.blockingProps)
  const tiles: Tile[][] = Array.from({ length: N }, () => Array.from({ length: N }, (): Tile => ({ kind: 'grass', blocked: false })))
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < N && y < N ? tiles[y][x] : undefined)
  const setKind = (x: number, y: number, kind: TileKind) => {
    const t = at(x, y)
    if (t) t.kind = t.kind === 'water' && kind === 'path' ? 'bridge' : kind
  }
  const setProp = (x: number, y: number, prop: string) => {
    const t = at(x, y)
    if (!t) return
    t.prop = prop
    t.blocked ||= blocking.has(prop)
  }

  if (L.river)
    for (let y = 0; y < N; y++) for (let w = 0; w < L.river.width; w++) setKind(L.river.x(y) + w, y, 'water')

  for (const [x0, y0, x1, y1] of L.roads)
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setKind(x, y, 'path')

  for (const area of L.areas)
    for (let y = area.rect.y0; y <= area.rect.y1; y++)
      for (let x = area.rect.x0; x <= area.rect.x1; x++) {
        setKind(x, y, area.kind)
        if (area.prop && (area.prop.every === 'tile' || y % 2 === 0)) setProp(x, y, area.prop.name)
      }

  for (const l of L.landmarks)
    for (let y = l.y; y < l.y + l.size; y++) for (let x = l.x; x < l.x + l.size; x++) at(x, y)!.blocked = true

  const buildings: Building[] = L.buildings.map((b) => {
    const mid = Math.floor(b.size / 2)
    const door = b.doorSide === 'left' ? { x: b.x + mid, y: b.y + b.size } : { x: b.x + b.size, y: b.y + mid }
    for (let y = b.y; y < b.y + b.size; y++)
      for (let x = b.x; x < b.x + b.size; x++) {
        const t = at(x, y)!
        t.blocked = true
        t.buildingId = b.id
      }
    return { ...b, door }
  })
  for (const b of buildings) carveToStreet(tiles, b.door)
  for (const p of L.props) setProp(p.x, p.y, p.kind)
  // Residents walk around guards rather than through them.
  for (const s of L.sentries ?? []) at(s.x, s.y)!.blocked = true

  const tools: LayoutTools = {
    size: N,
    rng,
    at,
    setKind,
    setProp,
    nearPaved: (x, y, r) => {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const t = at(x + dx, y + dy)
          if (t && (PAVED.has(t.kind) || t.buildingId)) return true
        }
      return false
    },
    adjacentTo: (x, y, pred) => DIRS_4.some(([dx, dy]) => {
      const t = at(x + dx, y + dy)
      return !!t && pred(t)
    }),
    inRect: (x, y, r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1,
  }
  L.decorate?.(tools)

  const world: World = { size: N, tiles, buildings, landmarks: L.landmarks, sentries: L.sentries ?? [], places: [] }
  world.places = buildPlaces(world, content)
  return world
}

/** BFS from a door through grass until it meets a street, then pave that route. */
function carveToStreet(tiles: Tile[][], door: Point) {
  const N = tiles.length
  const key = (p: Point) => p.y * N + p.x
  const prev = new Map<number, Point | null>([[key(door), null]])
  const queue: Point[] = [door]
  while (queue.length) {
    const p = queue.shift()!
    if (PAVED.has(tiles[p.y][p.x].kind)) {
      for (let cur = prev.get(key(p)); cur; cur = prev.get(key(cur))) if (tiles[cur.y][cur.x].kind === 'grass') tiles[cur.y][cur.x].kind = 'path'
      if (tiles[door.y][door.x].kind === 'grass') tiles[door.y][door.x].kind = 'path'
      return
    }
    for (const [dx, dy] of DIRS_4) {
      const n = { x: p.x + dx, y: p.y + dy }
      if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N || prev.has(key(n))) continue
      const nt = tiles[n.y][n.x]
      if (nt.blocked || nt.kind === 'water') continue
      prev.set(key(n), p)
      queue.push(n)
    }
  }
}

/** Walkable tiles connected to a seed tile, so no place can send someone into an enclosed pocket. */
function reachableFrom(world: World, start: Point): Point[] {
  const { tiles, size: N } = world
  const seen = new Uint8Array(N * N)
  const out: Point[] = []
  const stack = [start]
  seen[start.y * N + start.x] = 1
  while (stack.length) {
    const p = stack.pop()!
    out.push(p)
    for (const [dx, dy] of DIRS_4) {
      const n = { x: p.x + dx, y: p.y + dy }
      if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N || seen[n.y * N + n.x] || !isWalkable(tiles[n.y][n.x])) continue
      seen[n.y * N + n.x] = 1
      stack.push(n)
    }
  }
  return out
}

function buildPlaces(world: World, content: WorldContent): Place[] {
  const hub = world.buildings.find((b) => b.id === content.authorityOrigin.building)?.door
  const start = hub ?? content.strangerOrigin
  const walkable = reachableFrom(world, start)
  const where = (pred: (p: Point, t: Tile) => boolean) => walkable.filter((p) => pred(p, world.tiles[p.y][p.x]))
  const query: PlaceQuery = {
    world,
    walkable,
    where,
    aroundDoor: (id, r) => {
      const d = world.buildings.find((b) => b.id === id)!.door
      return where((p, t) => Math.abs(p.x - d.x) <= r && Math.abs(p.y - d.y) <= r && t.kind !== 'grass')
    },
    inRect: (r) => where((p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1),
  }
  return content.places.map((def) => ({ id: def.id, name: def.name, keywords: def.keywords ?? [], spots: def.spots(query) }))
}
