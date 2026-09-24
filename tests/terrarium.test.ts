import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Simulation } from '../src/core/sim/simulation'
import { fateCalendar } from '../src/core/realm/reign'
import { chapters, seasonOfDay } from '../src/core/realm/terrarium'
import { exportGame, importGame, restoreTown, saveTown } from '../src/app/townState'
import { content, memoryStorage } from './helpers'

describe('the terrarium calendar', () => {
  it('turns the seasons every ten days, starting in spring', () => {
    expect([0, 9, 10, 25, 39, 40].map((d) => seasonOfDay(d))).toEqual(['spring', 'spring', 'summer', 'autumn', 'winter', 'spring'])
  })

  it('deals the same blows of fate for the same seed, at daytime, in real places', () => {
    const a = fateCalendar(77, 40)
    expect(fateCalendar(77, 40)).toEqual(a)
    expect(fateCalendar(78, 40)).not.toEqual(a)
    const places = new Set(new Simulation(content).world.places.map((p) => p.id))
    for (const f of a) {
      expect(f.hour).toBeGreaterThanOrEqual(9)
      expect(f.hour).toBeLessThan(20)
      expect(places.has(f.place)).toBe(true)
    }
  })

  it('tells each day by its most striking line, newest first', () => {
    const day = (d: number, h: number) => 6 * 60 + d * 1440 + h * 60
    const out = chapters([
      { minutes: day(0, 0), kind: 'dawn', text: 'Amanece' },
      { minutes: day(0, 3), kind: 'decree', text: 'Impuesto al 20%' },
      { minutes: day(0, 5), kind: 'death', text: 'Murió Finn' },
      { minutes: day(1, 0), kind: 'dawn', text: 'Amanece otra vez' },
    ])
    expect(out.map((c) => c.day)).toEqual([1, 0])
    expect(out[1].headline?.text).toBe('Murió Finn')
    expect(out[0].headline).toBeNull()
  })
})

describe('a game in a file', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('goes out and comes back whole', () => {
    const a = new Simulation(content, 1)
    a.economy!.treasury = 321
    saveTown(content.id, a)
    localStorage.setItem(`ai-town:memory:${content.id}`, JSON.stringify({ v: 1, entries: [] }))
    const file = exportGame(content.id)
    localStorage.clear()
    expect(importGame(content.id, file)).toBeNull()
    const b = new Simulation(content, 2)
    restoreTown(content.id, b)
    expect(b.economy!.treasury).toBe(321)
  })

  it('refuses what is not a game of this world', () => {
    expect(importGame(content.id, 'nope')).toMatch(/no es una partida/)
    expect(importGame(content.id, JSON.stringify({ app: 'otra' }))).toMatch(/AI Town/)
    expect(importGame(content.id, JSON.stringify({ app: 'ai-town', world: 'otro', state: { v: 1 } }))).toMatch(/otro mundo/)
  })
})

describe('seasons from any start', () => {
  it('begins in the chosen season and keeps turning', () => {
    expect([0, 10, 20, 30].map((d) => seasonOfDay(d, 10, 3))).toEqual(['winter', 'spring', 'summer', 'autumn'])
  })
})

describe('a resident thinking out loud', () => {
  const input = async () => {
    const { startEconomy } = await import('../src/core/economy/economy')
    const e = startEconomy(content.economy!, content.residents.map((r) => r.id), 6 * 60)
    const resident = content.residents[0]
    return { resident, needs: e.needs[resident.id], coins: 10, foodPrice: 2, taxRate: 0.2, laws: [], trust: 0.5, news: ['Llegó una caravana.'], hour: 11 }
  }

  it('reads a model answer and keeps it within bounds', async () => {
    const { parseMusing } = await import('../src/core/realm/musing')
    expect(parseMusing('Pienso… {"pensamiento": "Qué hambre.", "animo": -3, "emoji": "😣"}')).toEqual({ thought: 'Qué hambre.', mood: -1, emoji: '😣' })
    expect(parseMusing('{"animo": 1}')).toBeNull()
    expect(parseMusing('sin json')).toBeNull()
  })

  it('worries about hunger first when thinking by rules, and the prompt carries the town', async () => {
    const { musingPrompt, rulesMusing } = await import('../src/core/realm/musing')
    const i = await input()
    expect(rulesMusing({ ...i, needs: { ...i.needs, daysHungry: 2 } }).mood).toBe(-1)
    expect(rulesMusing({ ...i, news: [] }).mood).toBe(1)
    expect(musingPrompt(i)).toContain('Llegó una caravana.')
  })
})
