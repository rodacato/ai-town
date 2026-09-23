import { RESIDENTS, type ResidentProfile, type RoutineSpot } from '../data/residents'
import { findPath } from './pathfinding'
import { createRng, type Rng } from './rng'
import type { Point } from './types'
import { createWorld, type World } from './world'

export type ResidentMode = 'walking' | 'idle' | 'inside'

export interface Resident {
  profile: ResidentProfile
  /** Continuous tile coordinates; a tile's center is (x + 0.5, y + 0.5). */
  x: number
  y: number
  path: Point[]
  mode: ResidentMode
  timer: number
  speed: number
  /** Screen-space facing: 1 = right, -1 = left. */
  facing: 1 | -1
  walkPhase: number
  chatting: string | null
  destination: RoutineSpot | null
}

const START_MINUTES = 10 * 60 + 30
const GAME_MINUTES_PER_SECOND = 1

export class Simulation {
  readonly world: World
  readonly residents: Resident[] = []
  minutes = START_MINUTES
  private rng: Rng
  private chatCheck = 0

  constructor(seed = 7) {
    this.world = createWorld()
    this.rng = createRng(seed)
    for (const profile of RESIDENTS) this.residents.push(this.spawn(profile))
  }

  get(id: string) {
    return this.residents.find((r) => r.profile.id === id)
  }

  tileOf(r: Resident): Point {
    return { x: Math.floor(r.x), y: Math.floor(r.y) }
  }

  update(dt: number) {
    this.minutes += dt * GAME_MINUTES_PER_SECOND
    for (const r of this.residents) this.step(r, dt)
    this.chatCheck -= dt
    if (this.chatCheck <= 0) {
      this.chatCheck = 1
      this.pairChats()
    }
  }

  private spawn(profile: ResidentProfile): Resident {
    const speed = profile.age >= 70 ? 0.7 : profile.age < 14 ? 1.45 : profile.id === 'pablo' ? 1.35 : 1.05
    const r: Resident = {
      profile,
      x: 0,
      y: 0,
      path: [],
      mode: 'idle',
      timer: this.rng.range(0.5, 6),
      speed: speed * this.rng.range(0.92, 1.08),
      facing: this.rng.chance(0.5) ? 1 : -1,
      walkPhase: this.rng.range(0, Math.PI * 2),
      chatting: null,
      destination: null,
    }
    const spot = this.pickDestination(r, true)
    const tile = spot?.tile ?? this.world.buildings.find((b) => b.id === profile.home)!.door
    r.x = tile.x + 0.5
    r.y = tile.y + 0.5
    r.destination = spot?.kind ?? null
    return r
  }

  private step(r: Resident, dt: number) {
    if (r.mode === 'walking') {
      r.walkPhase += dt * r.speed * 9
      let budget = r.speed * dt
      while (budget > 0 && r.path.length) {
        const next = r.path[0]
        const dx = next.x + 0.5 - r.x
        const dy = next.y + 0.5 - r.y
        const dist = Math.hypot(dx, dy)
        const screenDx = dx - dy
        if (Math.abs(screenDx) > 0.01) r.facing = screenDx > 0 ? 1 : -1
        if (dist <= budget) {
          r.x = next.x + 0.5
          r.y = next.y + 0.5
          r.path.shift()
          budget -= dist
        } else {
          r.x += (dx / dist) * budget
          r.y += (dy / dist) * budget
          budget = 0
        }
      }
      if (!r.path.length) this.arrive(r)
      return
    }
    r.timer -= dt
    if (r.timer > 0) return
    if (r.mode === 'inside') {
      const door = this.homeDoor(r)
      r.x = door.x + 0.5
      r.y = door.y + 0.5
    }
    r.chatting = null
    this.walkSomewhere(r)
  }

  private arrive(r: Resident) {
    if (r.destination === 'home') {
      r.mode = 'inside'
      r.timer = this.rng.range(8, 22)
      return
    }
    r.mode = 'idle'
    const long = r.destination === 'benches' || r.destination === 'field' || r.destination === 'riverbank'
    r.timer = long ? this.rng.range(10, 25) : this.rng.range(3, 11)
  }

  private walkSomewhere(r: Resident) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const spot = this.pickDestination(r, false)
      if (!spot) continue
      const path = findPath(this.world, this.tileOf(r), spot.tile)
      if (!path || path.length === 0) continue
      r.path = path
      r.destination = spot.kind
      r.mode = 'walking'
      return
    }
    r.mode = 'idle'
    r.timer = 2
  }

  private pickDestination(r: Resident, initial: boolean): { kind: RoutineSpot; tile: Point } | null {
    const options = Object.entries(r.profile.routine)
      .filter(([kind]) => !(initial && kind === 'home'))
      .filter(([kind]) => kind !== r.destination || kind === 'street' || kind === 'visit')
      .map(([kind, weight]) => ({ item: kind as RoutineSpot, weight: weight! }))
    if (!options.length) return null
    const kind = this.rng.weighted(options)
    const tile = this.tileFor(r, kind)
    return tile ? { kind, tile } : null
  }

  private tileFor(r: Resident, kind: RoutineSpot): Point | null {
    if (kind === 'home') return this.homeDoor(r)
    if (kind === 'visit') {
      const friends = r.profile.relationships
        .map((rel) => RESIDENTS.find((p) => p.id === rel.id)?.home)
        .filter((h): h is string => !!h && h !== r.profile.home)
      const houses = friends.length ? friends : this.world.buildings.map((b) => b.id)
      const houseId = this.rng.pick(houses)
      return this.world.buildings.find((b) => b.id === houseId)!.door
    }
    const place = this.world.places.find((p) => p.id === kind)
    if (!place?.spots.length) return null
    const taken = new Set(
      this.residents.filter((o) => o !== r).map((o) => {
        const end = o.path[o.path.length - 1] ?? this.tileOf(o)
        return `${end.x},${end.y}`
      }),
    )
    const free = place.spots.filter((s) => !taken.has(`${s.x},${s.y}`))
    return this.rng.pick(free.length ? free : place.spots)
  }

  private homeDoor(r: Resident) {
    return this.world.buildings.find((b) => b.id === r.profile.home)!.door
  }

  private pairChats() {
    const idle = this.residents.filter((r) => r.mode === 'idle' && !r.chatting)
    for (let i = 0; i < idle.length; i++)
      for (let j = i + 1; j < idle.length; j++) {
        const a = idle[i]
        const b = idle[j]
        if (a.chatting || b.chatting) continue
        if (Math.hypot(a.x - b.x, a.y - b.y) > 2.2 || !this.rng.chance(0.55)) continue
        a.chatting = b.profile.id
        b.chatting = a.profile.id
        const talk = this.rng.range(5, 10)
        a.timer = Math.max(a.timer, talk)
        b.timer = Math.max(b.timer, talk)
        const screenDx = b.x - b.y - (a.x - a.y)
        a.facing = screenDx >= 0 ? 1 : -1
        b.facing = screenDx >= 0 ? -1 : 1
      }
  }
}
