import { describe, expect, it } from 'vitest'
import { startEconomy } from '../src/core/economy/economy'
import { applyImpact } from '../src/core/economy/impact'
import { TownMemory } from '../src/core/memory/memory'
import { enact } from '../src/core/realm/decrees'
import { withDifficulty } from '../src/core/realm/difficulty'
import { fateCalendar, runReign } from '../src/core/realm/reign'
import { buildReport } from '../src/core/realm/report'
import { rulesRuler } from '../src/core/realm/ruler'
import { Chronicle } from '../src/core/realm/chronicle'
import { content } from './helpers'

const ids = content.residents.map((r) => r.id)
const rules = content.economy!

describe('difficulty', () => {
  it('leaves a normal game exactly as it was', () => {
    expect(fateCalendar(12, 40, 'normal')).toEqual(fateCalendar(12, 40))
    expect(withDifficulty(rules, 'normal')).toMatchObject({ startTreasury: rules.startTreasury, startGranary: rules.startGranary, harvestFactor: 1, harm: 1, rationCost: 3 })
  })

  it('brings more blows and fewer good ones the harder it gets', () => {
    const count = (d: 'normal' | 'dura' | 'cruel') => fateCalendar(12, 40, d)
    const boons = (d: 'normal' | 'dura' | 'cruel') => count(d).filter((f) => f.visual === 'caravan' || f.visual === 'treasure').length / count(d).length
    expect(count('dura').length).toBeGreaterThan(count('normal').length)
    expect(count('cruel').length).toBeGreaterThan(count('dura').length)
    expect(boons('cruel')).toBeLessThan(0.25)
  })

  it('starts leaner, harvests less, hits harder and sells grain dearer', () => {
    const cruel = withDifficulty(rules, 'cruel')
    const e = startEconomy(cruel, ids, 0)
    expect(e.treasury).toBe(Math.round(rules.startTreasury * 0.5))
    const normal = startEconomy(rules, ids, 0)
    const lossNormal = applyImpact(normal, 'flood', 5).food
    const lossCruel = applyImpact(startEconomy({ ...rules, harm: 1.5 }, ids, 0), 'flood', 5).food
    expect(lossCruel).toBeLessThan(lossNormal)
    e.treasury = 500
    enact(e, { kind: 'buyFood', rations: 10 })
    expect(e.treasury).toBe(450)
  })

  it('tells the Baroness what grain costs, and she buys only what she can pay', () => {
    const e = startEconomy(withDifficulty(rules, 'cruel'), ids, 6 * 60)
    e.granary = 5
    e.treasury = 100
    const r = buildReport({ content, economy: e, memory: new TownMemory(), chronicle: new Chronicle().entries, minutes: 6 * 60 + 30, season: 'winter', weather: 'clear', day: 3, seed: 1 })
    expect(r.rationCost).toBe(5)
    const buy = rulesRuler(r).actions.find((a) => a.kind === 'decree' && a.decree.kind === 'buyFood')
    expect(buy && buy.kind === 'decree' && buy.decree.kind === 'buyFood' && buy.decree.rations).toBe(20)
  })

  it('makes the same ruler score less in a crueler year', async () => {
    const reign = (d: 'normal' | 'cruel') => runReign({ content, days: 41, seed: 3, seasonLength: 10, fate: fateCalendar(3, 41, d), difficulty: d, rule: async (r) => rulesRuler(r) })
    const [easy, hard] = await Promise.all([reign('normal'), reign('cruel')])
    const alive = (x: typeof easy) => x.days.at(-1)!.population
    expect(alive(hard) + hard.days.at(-1)!.trust * 20).toBeLessThan(alive(easy) + easy.days.at(-1)!.trust * 20 + 1e-9)
  })

  it('weighs a deed of the guard at half a proclamation', () => {
    const m = new TownMemory()
    m.record({ id: 'd', minutes: 1, text: 'guardia', speaker: { kind: 'authority' }, truth: true, deed: true, summary: 'x', believers: [], doubters: [] })
    expect(m.reputation({ kind: 'authority' }).trust).toBeCloseTo(1.5 / 2.5)
  })
})

describe('a duel of rulers', () => {
  it('gives every ruler the same year, counts the days a model fails, and can be cancelled', async () => {
    const { absentDuelist, rulesDuelist, runDuel } = await import('../src/core/realm/duel')
    const broken = { id: 'roto', label: 'Roto', decide: async () => Promise.reject(new Error('sin red')) }
    const days: Record<string, number> = {}
    const duel = await runDuel({ content, seed: 5, days: 12, difficulty: 'dura', seasonLength: 10, rulers: [absentDuelist, rulesDuelist, broken], onDay: (id, d) => (days[id] = d + 1) })
    expect(duel.fate).toEqual(fateCalendar(5, 12, 'dura'))
    expect(duel.rulers.map((r) => r.label)).toEqual(['Trono vacío', 'Reglas', 'Roto'])
    const roto = duel.rulers.find((r) => r.id === 'roto')!
    // The last dawn ends the year, and nobody governs after it.
    expect(roto.summary.errors).toBe(roto.days.length - 1)
    expect(days.rules).toBe(duel.rulers[1].days.length - 1)

    const controller = new AbortController()
    controller.abort()
    await expect(runDuel({ content, seed: 5, days: 12, difficulty: 'normal', seasonLength: 10, rulers: [rulesDuelist], signal: controller.signal })).rejects.toThrow()
  })
})
