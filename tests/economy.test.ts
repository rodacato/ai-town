import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { catchUp, runDay, startEconomy } from '../src/core/economy/economy'
import { applyImpact, guardDeed, rollHours } from '../src/core/economy/impact'
import { TownMemory } from '../src/core/memory/memory'
import { ReactionEngine } from '../src/core/reactions/engine'
import { DecisionScheduler } from '../src/core/decisions/scheduler'
import { Simulation } from '../src/core/sim/simulation'
import { findPath } from '../src/core/world/pathfinding'
import { restoreTown, saveTown } from '../src/app/townState'
import { createRulesProvider } from '../src/providers/mock'
import { announce, content, exampleByTone, memoryStorage } from './helpers'

const rules = content.economy!
const ids = content.residents.map((r) => r.id)

describe('economy', () => {
  it('keeps a summer town fed and alive for a month', () => {
    const e = startEconomy(rules, ids, 0)
    for (let d = 1; d <= 30; d++) {
      const l = runDay(e, rules, 'summer', d)
      expect(l.unfed, `day ${d}`).toEqual([])
    }
    expect(Object.values(e.needs).every((n) => n.status === 'ok')).toBe(true)
  })

  it('starves the town in a winter without stores, the poorest first', () => {
    const e = startEconomy(rules, ids, 0)
    let firstHungry: string[] = []
    const lost: string[] = []
    for (let d = 1; d <= 20; d++) {
      const l = runDay(e, rules, 'winter', d)
      if (!firstHungry.length && l.unfed.length) firstHungry = l.unfed
      lost.push(...l.died, ...l.left)
    }
    expect(firstHungry.length).toBeGreaterThan(0)
    const richest = [...ids].sort((a, b) => (rules.jobs[b]?.income ?? 0) - (rules.jobs[a]?.income ?? 0))[0]
    expect(firstHungry).not.toContain(richest)
    expect(lost.length).toBeGreaterThan(0)
  })

  it('moves taxes into the treasury and sours the mood after a hike', () => {
    const e = startEconomy(rules, ids, 0)
    const before = e.treasury
    const l = runDay(e, rules, 'summer', 1)
    expect(l.taxes).toBeGreaterThan(0)
    expect(e.treasury).toBe(before + l.taxes + l.sold * e.foodPrice - l.wages)
    const calm = { ...e, needs: structuredClone(e.needs) }
    e.taxRate = 0.6
    runDay(e, rules, 'summer', 2)
    runDay(calm, rules, 'summer', 2)
    expect(Object.values(e.needs)[0].mood).toBeLessThan(Object.values(calm.needs)[0].mood)
  })

  it('lets real events hit the granary and the treasury', () => {
    const e = startEconomy(rules, ids, 0)
    const g = e.granary
    expect(applyImpact(e, 'flood', 5).text).toMatch(/crecida.*\(5 h\)/)
    expect(e.granary).toBe(g - Math.round(g * 0.3))
    const t = e.treasury
    applyImpact(e, 'thief')
    expect(e.treasury).toBeLessThan(t)
    const before = e.granary
    applyImpact(e, 'caravan', 5.5)
    expect(e.granary).toBe(before + 25)
  })

  it('charges a long event more than a short one, and a feast costs food', () => {
    const short = startEconomy(rules, ids, 0)
    const long = startEconomy(rules, ids, 0)
    applyImpact(short, 'blaze', 1, () => 0)
    applyImpact(long, 'blaze', 5, () => 0)
    expect(long.treasury).toBeLessThan(short.treasury)
    expect(long.granary).toBeLessThan(short.granary)
    const fed = startEconomy(rules, ids, 0)
    fed.needs[ids[0]].daysHungry = 2
    const g = fed.granary
    expect(applyImpact(fed, 'feast', 3.5).food).toBe(-15)
    expect(fed.granary).toBe(g - 15)
    expect(fed.needs[ids[0]].daysHungry).toBe(0)
  })

  it('lets the guard halve the harm and earn trust, or fail and lose it', () => {
    const open = startEconomy(rules, ids, 0)
    const guarded = startEconomy(rules, ids, 0)
    guarded.laws.levy = true
    const a = applyImpact(open, 'fire', 2.5, () => 0)
    const b = applyImpact(guarded, 'fire', 2.5, () => 0)
    expect(b.gold).toBeGreaterThan(a.gold)
    expect(a.hurt).toHaveLength(1)
    expect(b.hurt).toHaveLength(0)
    const memory = new TownMemory()
    memory.record(guardDeed(a, 'fire', 10)!)
    expect(memory.reputation({ kind: 'authority' })).toMatchObject({ bad: 1, lies: 0 })
    memory.record(guardDeed(b, 'fire', 20)!)
    memory.record(guardDeed(applyImpact(guarded, 'thief'), 'thief', 30)!)
    expect(memory.reputation({ kind: 'authority' }).trust).toBeGreaterThan(0.5)
    expect(guardDeed(applyImpact(open, 'caravan'), 'caravan', 40)).toBeNull()
  })

  it('rolls a duration within each event\'s range', () => {
    for (let i = 0; i < 20; i++) {
      const h = rollHours('flood')
      expect(h).toBeGreaterThanOrEqual(2)
      expect(h).toBeLessThanOrEqual(8)
    }
    expect(rollHours('treasure')).toBe(1)
  })

  it('runs each dawn once, even after a long jump', () => {
    const e = startEconomy(rules, ids, 6 * 60)
    expect(catchUp(e, rules, 'summer', 6 * 60 + 3 * 1440 + 10)).toHaveLength(3)
    expect(catchUp(e, rules, 'summer', 6 * 60 + 3 * 1440 + 20)).toHaveLength(0)
  })
})

describe('the town lives the economy', () => {
  it('digs a grave for the dead, walks the departed out, and leaves them out of announcements', async () => {
    const sim = new Simulation(content, 4)
    sim.economy!.granary = 0
    for (const id of ids) sim.economy!.purses[id] = 0
    const graves = sim.graves.length
    // Two winter weeks of dawns with nothing to eat.
    sim.season = 'winter'
    for (let t = 0; t < 14 * 1440; t += 30) sim.update(30)
    for (let t = 0; t < 120; t += 0.1) sim.update(0.1)
    expect(sim.graves.length).toBeGreaterThan(graves)
    // Every grave leaves the rest of the cemetery reachable.
    const hub = sim.world.buildings.find((b) => b.id === content.authorityOrigin.building)!.door
    for (const s of sim.world.places.find((p) => p.id === 'cemetery')!.spots) expect(findPath(sim.world, s, hub), `${s.x},${s.y}`).not.toBeNull()
    const gone = sim.residents.filter((r) => r.mode === 'gone')
    expect(gone.length).toBeGreaterThan(0)
    const engine = new ReactionEngine(sim, new DecisionScheduler(createRulesProvider(content.vocabulary), 8))
    engine.start(announce(sim, exampleByTone('confiable')))
    for (const r of gone) expect(engine.reactions.has(r.profile.id)).toBe(false)
  })
})

describe('saved town', () => {
  let storage: ReturnType<typeof memoryStorage>
  beforeEach(() => {
    storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('comes back after a reload with its clock, sky, purses, graves and people', () => {
    const a = new Simulation(content, 1)
    a.setHour(21)
    a.weather = 'snow'
    a.season = 'winter'
    a.economy!.treasury = 777
    a.restoreGraves([{ x: 5, y: 36 }])
    a.residents[0].x = 20.5
    saveTown(content.id, a)
    const b = new Simulation(content, 2)
    expect(restoreTown(content.id, b)).toEqual({ chronicle: [], reign: undefined })
    expect(b).toMatchObject({ minutes: a.minutes, weather: 'snow', season: 'winter' })
    expect(b.economy!.treasury).toBe(777)
    expect(b.graves).toEqual([{ x: 5, y: 36 }])
    expect(b.world.tiles[36][5].prop).toBe('grave')
    expect(b.residents[0].x).toBe(20.5)
  })

  it('starts fresh when nothing was saved', () => {
    expect(restoreTown(content.id, new Simulation(content))).toBeNull()
  })
})
