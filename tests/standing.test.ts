import { describe, expect, it } from 'vitest'
import { startEconomy } from '../src/core/economy/economy'
import { runReign } from '../src/core/realm/reign'
import { dawnStanding, freshStanding, guildWord } from '../src/core/realm/standing'
import { content } from './helpers'

const ids = content.residents.map((r) => r.id)
const town = () => startEconomy(content.economy!, ids, 6 * 60)

describe('the thieves guild', () => {
  it('strikes a fat, unguarded treasury and is held back by the levy', () => {
    const open = town()
    open.treasury = 600
    const s = freshStanding()
    let day = 1
    while (!s.heists && day < 30) dawnStanding(s, open, 0.5, day++, content)
    expect(s.heists).toBe(1)
    expect(open.treasury).toBeLessThan(600)
    expect(guildWord(s)).toBe('none')

    const guarded = town()
    guarded.treasury = 600
    guarded.laws.levy = true
    const g = freshStanding()
    for (let d = 1; d < 30; d++) dawnStanding(g, guarded, 0.5, d, content)
    expect(g.heists).toBe(0)
  })

  it('warns before it strikes', () => {
    const e = town()
    e.treasury = 600
    const s = { ...freshStanding(), plot: 0.7 }
    const lines = dawnStanding(s, e, 0.5, 1, content)
    expect(guildWord(s)).toBe('imminent')
    expect(lines.join(' ')).toMatch(/encapuchados/)
  })

  it('lets Bartolo pay his debt off bit by bit', () => {
    const e = town()
    e.purses.bartolo = 100
    const s = freshStanding()
    dawnStanding(s, e, 0.5, 1, content)
    expect(s.debt).toBe(87)
    expect(e.purses.bartolo).toBe(97)
  })
})

describe('the end of a reign', () => {
  it('rises in revolt after days of misery, not at the first bad dawn', () => {
    const e = town()
    for (const id of ids) e.needs[id].mood = 0.1
    const s = freshStanding()
    expect(dawnStanding(s, e, 0.5, 8, content).join(' ')).toMatch(/murmullos/)
    expect(s.end).toBeNull()
    dawnStanding(s, e, 0.5, 9, content)
    dawnStanding(s, e, 0.5, 10, content)
    expect(s.end?.title).toBe('Revuelta')
    expect(dawnStanding(s, e, 0.5, 11, content)).toEqual([])
  })

  it('ends when half the town is gone', () => {
    const e = town()
    ids.slice(0, 11).forEach((id) => (e.needs[id].status = 'gone'))
    const s = freshStanding()
    dawnStanding(s, e, 0.5, 3, content)
    expect(s.end).toMatchObject({ won: false, title: 'Pueblo desierto' })
  })

  it('crowns a full, happy year', () => {
    const s = freshStanding()
    dawnStanding(s, town(), 0.6, 40, content)
    expect(s.end).toMatchObject({ won: true, title: 'Año de prosperidad' })
  })

  it('topples a tyrant who taxes the town into misery', async () => {
    const tyrant = await runReign({
      content,
      days: 40,
      seed: 5,
      seasonLength: 10,
      fate: [],
      rule: async (r) => ({ thought: '', actions: r.day === 0 ? [{ kind: 'decree', decree: { kind: 'tax', rate: 0.6 } }, { kind: 'decree', decree: { kind: 'price', price: 6 } }] : [], problems: [] }),
    })
    expect(tyrant.ending?.won).toBe(false)
    expect(tyrant.survivedDays).toBeLessThan(40)
  })
})

describe('a ruler duel', () => {
  it('scores the same seed fairly and ranks the better ruler first', async () => {
    const { summarize, ranking } = await import('../src/core/realm/duel')
    const { fateCalendar } = await import('../src/core/realm/reign')
    const { rulesRuler } = await import('../src/core/realm/ruler')
    const base = { content, days: 41, seed: 8, seasonLength: 10, fate: fateCalendar(content, 8, 41) }
    const absent = summarize({ id: 'absent', label: 'Trono vacío' }, await runReign({ ...base, rule: async () => ({ thought: '', actions: [], problems: [] }) }))
    const ruled = summarize({ id: 'rules', label: 'Reglas' }, await runReign({ ...base, rule: async (r) => rulesRuler(r) }))
    expect(ruled.won).toBe(true)
    expect(ranking([absent, ruled]).map((r) => r.rulerId)).toEqual(['rules', 'absent'])
    expect(ruled.score).toBeGreaterThan(absent.score)
  })
})
