import { describe, expect, it } from 'vitest'
import { foodDays, runDay, startEconomy } from '../src/core/economy/economy'
import { enact, LIMITS } from '../src/core/realm/decrees'
import { content } from './helpers'

const rules = content.economy!
const ids = content.residents.map((r) => r.id)
const fresh = () => startEconomy(rules, ids, 0)

describe('decrees', () => {
  it('changes taxes and prices within limits, and says why when it cannot', () => {
    const e = fresh()
    expect(enact(e, { kind: 'tax', rate: 0.3 }, content.realm!)).toMatchObject({ ok: true, proclamation: expect.stringContaining('sube') })
    expect(e.taxRate).toBe(0.3)
    expect(enact(e, { kind: 'tax', rate: 0.9 }, content.realm!)).toMatchObject({ ok: false, reason: expect.stringContaining('60%') })
    expect(enact(e, { kind: 'tax', rate: 0.3 }, content.realm!).ok).toBe(false)
    expect(enact(e, { kind: 'price', price: 0 }, content.realm!)).toMatchObject({ ok: true, proclamation: expect.stringContaining('gratis') })
    expect(enact(e, { kind: 'price', price: 2.5 }, content.realm!).ok).toBe(false)
  })

  it('spends the treasury only when it can afford it', () => {
    const e = fresh()
    e.treasury = 10
    expect(enact(e, { kind: 'buyFood', rations: 30 }, content.realm!)).toMatchObject({ ok: false, reason: expect.stringContaining('No alcanza') })
    expect(e.treasury).toBe(10)
    e.treasury = 200
    const g = e.granary
    expect(enact(e, { kind: 'buyFood', rations: 30 }, content.realm!).ok).toBe(true)
    expect(e).toMatchObject({ treasury: 200 - 30 * LIMITS.rationCost, granary: g + 30 })
  })

  it('feeds the hungry from the granary', () => {
    const e = fresh()
    expect(enact(e, { kind: 'handout' }, content.realm!).ok).toBe(false)
    e.needs.pip.daysHungry = 2
    e.needs.grum.daysHungry = 1
    expect(enact(e, { kind: 'handout' }, content.realm!)).toMatchObject({ ok: true, summary: expect.stringContaining('2 raciones') })
    expect(e.needs.pip.daysHungry).toBe(0)
  })

  it('rationing doubles how long the granary lasts, at a cost in mood', () => {
    const a = fresh()
    const b = fresh()
    const before = foodDays(a)
    enact(b, { kind: 'law', law: 'rationing', on: true }, content.realm!)
    expect(foodDays(b)).toBeCloseTo(before * 2)
    runDay(a, rules, 'summer', 1)
    runDay(b, rules, 'summer', 1)
    expect(b.needs.pip.mood).toBeLessThan(a.needs.pip.mood)
    expect(enact(b, { kind: 'law', law: 'rationing', on: true }, content.realm!).ok).toBe(false)
  })

  it('lets a careful ruler carry the town through a winter that would otherwise empty it', () => {
    const idle = fresh()
    const ruled = fresh()
    const lost = (e: typeof idle) => ids.filter((id) => e.needs[id].status === 'dead' || e.needs[id].status === 'gone').length
    // Autumn: stock up, then ration and top up the granary through the snow.
    for (let d = 1; d <= 7; d++) {
      runDay(idle, rules, 'autumn', d)
      runDay(ruled, rules, 'autumn', d)
    }
    enact(ruled, { kind: 'buyFood', rations: 100 }, content.realm!)
    enact(ruled, { kind: 'law', law: 'rationing', on: true }, content.realm!)
    for (let d = 8; d <= 21; d++) {
      runDay(idle, rules, 'winter', d)
      runDay(ruled, rules, 'winter', d)
      if (foodDays(ruled) < 3 && ruled.treasury >= 60 * LIMITS.rationCost) enact(ruled, { kind: 'buyFood', rations: 60 }, content.realm!)
    }
    expect(lost(idle)).toBeGreaterThan(0)
    expect(lost(ruled)).toBe(0)
  })
})
