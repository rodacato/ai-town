import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { catchUp, runDay, startEconomy } from '../src/core/economy/economy'
import { applyImpact } from '../src/core/economy/impact'
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
    expect(applyImpact(e, 'flood')).toMatch(/crecida/)
    expect(e.granary).toBe(g - Math.round(g * 0.3))
    const t = e.treasury
    applyImpact(e, 'thief')
    expect(e.treasury).toBeLessThan(t)
    applyImpact(e, 'caravan')
    expect(e.granary).toBe(g - Math.round(g * 0.3) + 25)
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
    expect(restoreTown(content.id, b)).toBe(true)
    expect(b).toMatchObject({ minutes: a.minutes, weather: 'snow', season: 'winter' })
    expect(b.economy!.treasury).toBe(777)
    expect(b.graves).toEqual([{ x: 5, y: 36 }])
    expect(b.world.tiles[36][5].prop).toBe('grave')
    expect(b.residents[0].x).toBe(20.5)
  })

  it('starts fresh when nothing was saved', () => {
    expect(restoreTown(content.id, new Simulation(content))).toBe(false)
  })
})
