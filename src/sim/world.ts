import { BUILDINGS, MAP_SIZE, WORLD_SEED } from '../data/town'
import { createRng } from './rng'
import type { Building, Place, PlaceKind, Point, PropKind, Tile, TileKind } from './types'

export interface World {
  size: number
  tiles: Tile[][]
  buildings: Building[]
  places: Place[]
  fountain: { x: number; y: number; size: number }
}

const BLOCKING_PROPS = new Set<PropKind>(['tree', 'pine', 'bush', 'lamp', 'rock', 'stall', 'well', 'fence'])
const PLAZA = { x0: 10, y0: 12, x1: 16, y1: 18 }
const FOUNTAIN = { x: 12, y: 14, size: 3 }
const PARK = { x0: 17, y0: 24, x1: 21, y1: 29 }
const FIELD = { x0: 1, y0: 1, x1: 4, y1: 4 }

export const riverX = (y: number) => 23 + Math.round(1.3 * Math.sin(y * 0.28 + 0.6))

export function isWalkable(t: Tile | undefined) {
  return !!t && !t.blocked && t.kind !== 'water'
}

export function tileCost(t: Tile) {
  if (t.prop === 'bench') return 4
  switch (t.kind) {
    case 'path':
    case 'plaza':
    case 'bridge':
      return 1
    case 'field':
      return 3
    default:
      return 2.2
  }
}

export function createWorld(): World {
  const N = MAP_SIZE
  const rng = createRng(WORLD_SEED)
  const tiles: Tile[][] = Array.from({ length: N }, () =>
    Array.from({ length: N }, (): Tile => ({ kind: 'grass', blocked: false })),
  )
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < N && y < N ? tiles[y][x] : undefined)
  const setKind = (x: number, y: number, kind: TileKind) => {
    const t = at(x, y)
    if (!t) return
    t.kind = t.kind === 'water' && kind === 'path' ? 'bridge' : kind
  }
  const setProp = (x: number, y: number, prop: PropKind) => {
    const t = at(x, y)
    if (!t) return
    t.prop = prop
    t.blocked = t.blocked || BLOCKING_PROPS.has(prop)
  }
  const rect = (r: { x0: number; y0: number; x1: number; y1: number }, fn: (x: number, y: number) => void) => {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) fn(x, y)
  }
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setKind(x, y, 'path')
  }

  for (let y = 0; y < N; y++) {
    const cx = riverX(y)
    setKind(cx, y, 'water')
    setKind(cx + 1, y, 'water')
  }

  line(1, 15, N - 2, 15)
  line(13, 1, 13, N - 2)
  line(3, 6, 13, 6)
  line(4, 6, 4, 24)
  line(4, 24, 20, 24)
  rect(PLAZA, (x, y) => setKind(x, y, 'plaza'))
  rect({ x0: FOUNTAIN.x, y0: FOUNTAIN.y, x1: FOUNTAIN.x + 2, y1: FOUNTAIN.y + 2 }, (x, y) => {
    at(x, y)!.blocked = true
  })
  rect(FIELD, (x, y) => {
    setKind(x, y, 'field')
    if (y % 2 === 0) setProp(x, y, 'crop')
  })
  rect({ x0: 19, y0: 27, x1: 20, y1: 28 }, (x, y) => setKind(x, y, 'water'))

  const buildings: Building[] = BUILDINGS.map((b) => {
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

  const benches: Point[] = [
    { x: 10, y: 12 },
    { x: 16, y: 12 },
    { x: 10, y: 18 },
    { x: 16, y: 18 },
    { x: 18, y: 25 },
    { x: 21, y: 27 },
    { x: 17, y: 28 },
  ]
  for (const b of benches) setProp(b.x, b.y, 'bench')

  for (let x = 2; x < N - 2; x += 4) if (at(x, 14)?.kind === 'grass') setProp(x, 14, 'lamp')
  for (let y = 3; y < N - 2; y += 4) if (at(14, y)?.kind === 'grass') setProp(14, y, 'lamp')
  setProp(11, 20, 'well')
  setProp(9, 13, 'stall')
  setProp(9, 14, 'stall')

  const nearStreet = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const t = at(x + dx, y + dy)
        if (t && (t.kind === 'path' || t.kind === 'plaza' || t.kind === 'bridge' || t.buildingId)) return true
      }
    return false
  }
  const adjacentTo = (x: number, y: number, pred: (t: Tile) => boolean) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => {
      const t = at(x + dx, y + dy)
      return !!t && pred(t)
    })
  const inRect = (x: number, y: number, r: typeof PARK) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const t = tiles[y][x]
      if (t.kind !== 'grass' || t.prop || t.blocked) continue
      const eastBank = x > riverX(y) + 2
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1
      if (adjacentTo(x, y, (n) => n.kind === 'water')) {
        if (rng.chance(0.35)) setProp(x, y, 'reeds')
        continue
      }
      if (nearStreet(x, y, 1)) {
        if (adjacentTo(x, y, (n) => !!n.buildingId) && rng.chance(0.4)) setProp(x, y, 'flowers')
        continue
      }
      if (eastBank) {
        const r = rng.next()
        if (r < 0.5) setProp(x, y, 'pine')
        else if (r < 0.62) setProp(x, y, 'tree')
        else if (r < 0.66) setProp(x, y, 'bush')
        continue
      }
      if (inRect(x, y, PARK)) {
        const r = rng.next()
        if (r < 0.18) setProp(x, y, 'tree')
        else if (r < 0.34) setProp(x, y, 'flowers')
        continue
      }
      const r = rng.next()
      if (r < (edge ? 0.3 : 0.1)) setProp(x, y, rng.chance(0.3) ? 'pine' : 'tree')
      else if (r < (edge ? 0.36 : 0.14)) setProp(x, y, 'bush')
      else if (r < (edge ? 0.38 : 0.17)) setProp(x, y, 'flowers')
      else if (r < (edge ? 0.4 : 0.18)) setProp(x, y, 'rock')
    }

  const world: World = { size: N, tiles, buildings, places: [], fountain: FOUNTAIN }
  world.places = buildPlaces(world)
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
    const t = tiles[p.y][p.x]
    if (t.kind === 'path' || t.kind === 'plaza' || t.kind === 'bridge') {
      let cur: Point | null | undefined = prev.get(key(p))
      while (cur) {
        if (tiles[cur.y][cur.x].kind === 'grass') tiles[cur.y][cur.x].kind = 'path'
        cur = prev.get(key(cur))
      }
      if (tiles[door.y][door.x].kind === 'grass') tiles[door.y][door.x].kind = 'path'
      return
    }
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy }
      if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N || prev.has(key(n))) continue
      const nt = tiles[n.y][n.x]
      if (nt.blocked || nt.kind === 'water') continue
      prev.set(key(n), p)
      queue.push(n)
    }
  }
}

/** Walkable tiles connected to the plaza, so no place can send someone into a pocket enclosed by trees. */
function reachableTiles(world: World): Point[] {
  const { tiles, size: N } = world
  const start = { x: PLAZA.x0, y: PLAZA.y0 + 1 }
  const seen = new Uint8Array(N * N)
  const out: Point[] = []
  const queue = [start]
  seen[start.y * N + start.x] = 1
  while (queue.length) {
    const p = queue.pop()!
    out.push(p)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy }
      if (n.x < 0 || n.y < 0 || n.x >= N || n.y >= N || seen[n.y * N + n.x] || !isWalkable(tiles[n.y][n.x])) continue
      seen[n.y * N + n.x] = 1
      queue.push(n)
    }
  }
  return out
}

function buildPlaces(world: World): Place[] {
  const { tiles } = world
  const walkable = reachableTiles(world)
  const where = (pred: (p: Point, t: Tile) => boolean) => walkable.filter((p) => pred(p, tiles[p.y][p.x]))
  const around = (c: Point, r: number) =>
    where((p) => Math.abs(p.x - c.x) <= r && Math.abs(p.y - c.y) <= r && tiles[p.y][p.x].kind !== 'grass')
  const byId = (id: string) => world.buildings.find((b) => b.id === id)!
  const f = world.fountain

  const place = (id: string, name: string, kind: PlaceKind, spots: Point[]): Place => ({ id, name, kind, spots })
  return [
    place('plaza', 'la plaza', 'plaza', where((_, t) => t.kind === 'plaza' && !t.prop)),
    place(
      'fountain',
      'la fuente',
      'fountain',
      where((p) => p.x >= f.x - 1 && p.x <= f.x + f.size && p.y >= f.y - 1 && p.y <= f.y + f.size),
    ),
    place('benches', 'los bancos', 'bench', where((_, t) => t.prop === 'bench')),
    place('cafe', byId('cafe').name, 'cafe', around(byId('cafe').door, 2)),
    place('bakery', byId('bakery').name, 'bakery', around(byId('bakery').door, 2)),
    place('shop', byId('shop').name, 'shop', around(byId('shop').door, 2)),
    place('townhall', byId('townhall').name, 'townhall', around(byId('townhall').door, 2)),
    place('park', 'el parque', 'park', where((p, t) => inPark(p) && t.kind === 'grass')),
    place(
      'riverbank',
      'la orilla del río',
      'riverbank',
      where((p, t) => t.kind === 'grass' && p.x === riverX(p.y) - 1 && p.y > 8 && p.y < 24),
    ),
    place('forest', 'el bosque', 'forest', where((p, t) => t.kind === 'grass' && p.x > riverX(p.y) + 2)),
    place('field', 'el huerto', 'field', where((_, t) => t.kind === 'field')),
    place('bridge', 'el puente', 'bridge', where((_, t) => t.kind === 'bridge')),
    place('street', 'la calle', 'street', where((_, t) => t.kind === 'path')),
  ]
}

const inPark = (p: Point) => p.x >= PARK.x0 && p.x <= PARK.x1 && p.y >= PARK.y0 && p.y <= PARK.y1
