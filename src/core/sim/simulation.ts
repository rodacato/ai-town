import type { ResidentProfile, WorldContent } from '../world/content'
import { findPath } from '../world/pathfinding'
import { createRng, type Rng } from '../world/rng'
import type { Point } from '../world/types'
import { createWorld, isWalkable, type World } from '../world/world'
import { routineNow, staysIn } from './rhythm'
import { catchUp, startEconomy, type Economy, type Ledger } from '../economy/economy'
import type { Season } from './season'
import type { Weather } from './weather'

/** 'gone' means off the map for good: moved away or dead. */
export type ResidentMode = 'walking' | 'idle' | 'inside' | 'gone'

/** Scripted behaviour that overrides the daily routine, e.g. a reaction to an announcement. */
export type Task =
  | { kind: 'walk'; to: Point; label: string }
  | { kind: 'wait'; seconds: number; label: string }
  | { kind: 'enterHome'; label: string }
  | { kind: 'stay'; label: string }
  | { kind: 'meet'; who: string; seconds: number; label: string; onMeet: () => void; met?: boolean }
  | { kind: 'vanish'; label: string }

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
  destination: string | null
  tasks: Task[]
  /** Stops in place, e.g. while hearing and thinking about an announcement. */
  frozen: boolean
  repathIn: number
}

const START_MINUTES = 10 * 60 + 30
const GAME_MINUTES_PER_SECOND = 1
const NEIGHBORS_8 = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
]

export class Simulation {
  readonly world: World
  readonly residents: Resident[] = []
  minutes = START_MINUTES
  weather: Weather = 'clear'
  season: Season = 'summer'
  /** The town's purse, granary and people's needs; null for worlds without an economy. */
  economy: Economy | null
  /** Graves dug for residents who died, so a reset can clear them. */
  graves: Point[] = []
  private ledgerListeners = new Set<(l: Ledger) => void>()
  private rng: Rng
  private chatCheck = 0
  private tickers = new Set<(dt: number) => void>()

  constructor(
    readonly content: WorldContent,
    seed = 7,
  ) {
    this.world = createWorld(content)
    this.rng = createRng(seed)
    for (const profile of content.residents) this.residents.push(this.spawn(profile))
    this.economy = content.economy ? startEconomy(content.economy, content.residents.map((r) => r.id), this.minutes) : null
  }

  /** Respawns everyone in place so renderer sprites keep pointing at the same Resident objects. */
  reset(seed = Date.now()) {
    this.rng = createRng(seed)
    this.minutes = START_MINUTES
    this.weather = 'clear'
    this.season = 'summer'
    const fresh = this.residents.map((r) => this.spawn(r.profile))
    fresh.forEach((f, i) => Object.assign(this.residents[i], f))
    this.economy = this.content.economy ? startEconomy(this.content.economy, this.content.residents.map((r) => r.id), this.minutes) : null
    const cemetery = this.world.places.find((p) => p.id === 'cemetery')
    for (const g of this.graves) {
      this.world.tiles[g.y][g.x] = { ...this.world.tiles[g.y][g.x], prop: undefined, blocked: false }
      cemetery?.spots.push(g)
    }
    this.graves = []
    this.world.version++
  }

  /** Jumps to an hour of the current day; the day does not change. */
  setHour(hour: number) {
    this.minutes = Math.floor(this.minutes / 1440) * 1440 + hour * 60
  }

  get(id: string) {
    return this.residents.find((r) => r.profile.id === id)
  }

  tileOf(r: Resident): Point {
    return { x: Math.floor(r.x), y: Math.floor(r.y) }
  }

  homeDoor(r: Resident) {
    return this.world.buildings.find((b) => b.id === r.profile.home)!.door
  }

  /** Called with each dawn's accounts, after departures are applied. */
  onLedger(fn: (l: Ledger) => void) {
    this.ledgerListeners.add(fn)
    return () => this.ledgerListeners.delete(fn)
  }

  /** The season a dawn brings, when it brings a new one; set by whoever keeps the calendar. The harvest of that dawn already follows it. */
  seasonAt: ((day: number) => Season | null) | null = null

  /** Runs the dawn ledger for any day that has begun, and sends the dead and the departed off the map. */
  private settleDays() {
    if (!this.economy || !this.content.economy) return
    const seasonOf = (day: number) => (this.season = this.seasonAt?.(day) ?? this.season)
    for (const ledger of catchUp(this.economy, this.content.economy, seasonOf, this.minutes)) {
      for (const id of ledger.died) {
        const r = this.get(id)!
        r.mode = 'gone'
        r.tasks = []
        r.path = []
        this.digGrave()
      }
      for (const id of ledger.left) {
        const r = this.get(id)!
        const exit = this.spotAt('gate')
        this.assign(r, exit ? [{ kind: 'walk', to: exit, label: 'Se marcha del pueblo' }, { kind: 'vanish', label: 'Se fue del pueblo' }] : [{ kind: 'vanish', label: 'Se fue del pueblo' }])
        r.frozen = false
      }
      for (const fn of this.ledgerListeners) fn(ledger)
    }
  }

  /** Puts back graves dug in an earlier session. */
  restoreGraves(graves: Point[]) {
    const cemetery = this.world.places.find((p) => p.id === 'cemetery')
    for (const g of graves) {
      this.world.tiles[g.y][g.x] = { ...this.world.tiles[g.y][g.x], prop: 'grave', blocked: true }
      if (cemetery) cemetery.spots = cemetery.spots.filter((s) => s.x !== g.x || s.y !== g.y)
    }
    this.graves = [...graves]
    this.world.version++
  }

  /** A new grave in the cemetery, on a free tile that leaves the rest of it reachable. */
  private digGrave() {
    const cemetery = this.world.places.find((p) => p.id === 'cemetery')
    if (!cemetery) return
    const occupied = (s: Point) => this.residents.some((r) => r.mode !== 'gone' && Math.floor(r.x) === s.x && Math.floor(r.y) === s.y)
    const outside = this.spotAt('street') ?? this.homeDoor(this.residents[0])
    const keepsItOpen = (s: Point) => {
      const tile = this.world.tiles[s.y][s.x]
      tile.blocked = true
      const ok = cemetery.spots.every((o) => (o.x === s.x && o.y === s.y) || findPath(this.world, o, outside) !== null)
      tile.blocked = false
      return ok
    }
    const spot = [...cemetery.spots].reverse().find((s) => !this.world.tiles[s.y][s.x].prop && !occupied(s) && keepsItOpen(s))
    if (!spot) return
    this.world.tiles[spot.y][spot.x] = { ...this.world.tiles[spot.y][spot.x], prop: 'grave', blocked: true }
    cemetery.spots.splice(cemetery.spots.indexOf(spot), 1)
    this.graves.push(spot)
    this.world.version++
  }

  onTick(fn: (dt: number) => void) {
    this.tickers.add(fn)
    return () => this.tickers.delete(fn)
  }

  /** A free standing spot for a place, preferring ones nobody else is heading to. */
  spotAt(placeId: string): Point | null {
    const place = this.world.places.find((p) => p.id === placeId)
    if (!place?.spots.length) return null
    const taken = this.takenTiles()
    const free = place.spots.filter((s) => !taken.has(`${s.x},${s.y}`))
    return this.rng.pick(free.length ? free : place.spots)
  }

  /** A walkable spot a few tiles from a place, for residents who watch from a distance. */
  lookoutFor(placeId: string, from: Point): Point | null {
    const place = this.world.places.find((p) => p.id === placeId)
    if (!place?.spots.length) return null
    const n = place.spots.length
    const c = place.spots.reduce((a, s) => ({ x: a.x + s.x / n, y: a.y + s.y / n }), { x: 0, y: 0 })
    const dx = from.x - c.x
    const dy = from.y - c.y
    const len = Math.hypot(dx, dy) || 1
    for (let d = 4; d <= 8; d++) {
      const p = { x: Math.round(c.x + (dx / len) * d), y: Math.round(c.y + (dy / len) * d) }
      if (isWalkable(this.world.tiles[p.y]?.[p.x])) return p
    }
    return this.spotAt(placeId)
  }

  assign(r: Resident, tasks: Task[]) {
    r.tasks = tasks
    r.path = []
    r.timer = 0
    r.chatting = null
    r.frozen = false
    if (r.mode === 'walking') r.mode = 'idle'
  }

  update(dt: number) {
    this.minutes += dt * GAME_MINUTES_PER_SECOND
    this.settleDays()
    for (const r of this.residents) this.step(r, dt)
    this.chatCheck -= dt
    if (this.chatCheck <= 0) {
      this.chatCheck = 1
      this.pairChats()
    }
    for (const fn of this.tickers) fn(dt)
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
      tasks: [],
      frozen: false,
      repathIn: 0,
    }
    const spot = this.pickDestination(r, true)
    const tile = spot?.tile ?? this.world.buildings.find((b) => b.id === profile.home)!.door
    r.x = tile.x + 0.5
    r.y = tile.y + 0.5
    r.destination = spot?.kind ?? null
    return r
  }

  private step(r: Resident, dt: number) {
    if (r.frozen || r.mode === 'gone') return
    if (r.mode === 'walking') {
      this.move(r, dt)
      if (r.path.length) {
        if (r.tasks[0]?.kind === 'meet') this.runTask(r, dt)
        return
      }
      r.mode = 'idle'
      if (!r.tasks.length) return this.arrive(r)
    }
    if (r.tasks.length) return this.runTask(r, dt)
    r.timer -= dt
    if (r.timer > 0) return
    if (r.mode === 'inside' && staysIn(r.profile, this.minutes, this.economy?.laws.curfew)) {
      r.timer = this.rng.range(10, 20)
      return
    }
    this.leaveHome(r)
    r.chatting = null
    this.walkSomewhere(r)
  }

  private move(r: Resident, dt: number) {
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
  }

  private runTask(r: Resident, dt: number) {
    const task = r.tasks[0]
    const done = () => {
      r.tasks.shift()
      r.path = []
      r.timer = 0
    }
    switch (task.kind) {
      case 'walk': {
        this.leaveHome(r)
        const here = this.tileOf(r)
        if (here.x === task.to.x && here.y === task.to.y) return done()
        if (!this.walkTo(r, task.to)) done()
        return
      }
      case 'wait':
        r.timer += dt
        if (r.timer >= task.seconds) done()
        return
      case 'enterHome': {
        if (r.mode === 'inside') return
        const door = this.homeDoor(r)
        const here = this.tileOf(r)
        if (here.x === door.x && here.y === door.y) r.mode = 'inside'
        else if (!this.walkTo(r, door)) r.mode = 'inside'
        return
      }
      case 'stay':
        return
      case 'vanish':
        r.mode = 'gone'
        r.tasks = []
        return
      case 'meet': {
        const other = this.get(task.who)!
        if (!task.met) this.leaveHome(r)
        const target = other.mode === 'inside' ? this.homeDoor(other) : this.tileOf(other)
        const dist = Math.hypot(r.x - (target.x + 0.5), r.y - (target.y + 0.5))
        if (task.met || dist < 1.6) {
          if (!task.met) {
            task.met = true
            r.path = []
            r.mode = 'idle'
            const screenDx = target.x - target.y - (r.x - r.y)
            r.facing = screenDx >= 0 ? 1 : -1
            if (other.mode !== 'inside' && !other.frozen) other.facing = screenDx >= 0 ? -1 : 1
            task.onMeet()
          }
          r.timer += dt
          if (r.timer >= task.seconds) done()
          return
        }
        r.repathIn -= dt
        if (r.repathIn <= 0) {
          r.repathIn = 1
          if (!this.walkTo(r, target, true)) done()
        }
        return
      }
    }
  }

  private walkTo(r: Resident, to: Point, adjacent = false) {
    let goal = to
    if (adjacent || !isWalkable(this.world.tiles[to.y]?.[to.x])) {
      const around = NEIGHBORS_8.map(([dx, dy]) => ({ x: to.x + dx, y: to.y + dy }))
        .filter((p) => isWalkable(this.world.tiles[p.y]?.[p.x]))
        .sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y))
      goal = around[0] ?? to
    }
    const path = findPath(this.world, this.tileOf(r), goal)
    if (!path?.length) return false
    r.path = path
    r.mode = 'walking'
    return true
  }

  private leaveHome(r: Resident) {
    if (r.mode !== 'inside') return
    const door = this.homeDoor(r)
    r.x = door.x + 0.5
    r.y = door.y + 0.5
    r.mode = 'idle'
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

  private pickDestination(r: Resident, initial: boolean): { kind: string; tile: Point } | null {
    const options = Object.entries(routineNow(r.profile, this.minutes, this.weather, this.season, this.economy?.laws.curfew))
      .filter(([kind]) => !(initial && kind === 'home'))
      .filter(([kind]) => kind !== r.destination || kind === 'street' || kind === 'visit')
      .map(([kind, weight]) => ({ item: kind, weight }))
    if (!options.length) return null
    const kind = this.rng.weighted(options)
    const tile = this.tileFor(r, kind)
    return tile ? { kind, tile } : null
  }

  private tileFor(r: Resident, kind: string): Point | null {
    if (kind === 'home') return this.homeDoor(r)
    if (kind === 'visit') {
      const friends = r.profile.relationships
        .map((rel) => this.content.residents.find((p) => p.id === rel.id)?.home)
        .filter((h): h is string => !!h && h !== r.profile.home)
      const houses = friends.length ? friends : this.world.buildings.map((b) => b.id)
      const houseId = this.rng.pick(houses)
      return this.world.buildings.find((b) => b.id === houseId)!.door
    }
    return this.spotAt(kind)
  }

  private takenTiles() {
    return new Set(
      this.residents.map((o) => {
        const end = o.path[o.path.length - 1] ?? this.tileOf(o)
        return `${end.x},${end.y}`
      }),
    )
  }

  private pairChats() {
    const idle = this.residents.filter((r) => r.mode === 'idle' && !r.chatting && !r.tasks.length && !r.frozen)
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
