import { describe, expect, it } from 'vitest'
import { startEconomy } from '../src/core/economy/economy'
import { enact } from '../src/core/realm/decrees'
import { musingInputFor, musingSystem, rulesMusing } from '../src/core/realm/musing'
import { grievances, petitionPrompt, petitionSystem } from '../src/core/realm/petitions'
import { rulerSystem } from '../src/core/realm/ruler'
import { dawnStanding, freshStanding } from '../src/core/realm/standing'
import type { WorldContent } from '../src/core/world/content'
import { WORLDS, worldById } from '../src/worlds'
import { content } from './helpers'

/** Chismeroble under another name and another ruler: whatever still says Chismeroble or Baronesa was hard-coded. */
const other: WorldContent = {
  ...content,
  id: 'otro',
  name: 'Villaotra',
  realm: {
    ruler: { short: 'Alcalde', title: 'el Alcalde', name: 'el Alcalde Ramiro', address: 'señor alcalde', seat: 'el ayuntamiento' },
    guild: { name: 'la banda del puerto', debtor: 'finn' },
    petitioners: { hunger: 'agnes', granary: 'rowan' },
    festivalPlace: 'el muelle',
  },
}
const ids = other.residents.map((r) => r.id)
const leaks = (text: string) => expect(text).not.toMatch(/Chismeroble|Baronesa|Isolda|Bartolo|castillo/)

describe('a realm that is not Chismeroble', () => {
  it('tells the ruler who she is and who owes the guild', () => {
    const text = rulerSystem(other)
    expect(text).toContain('Eres el Alcalde Ramiro y gobiernas Villaotra')
    expect(text).toContain('La banda del puerto, al que Finn debe dinero')
    leaks(text)
  })

  it('words decrees, dawns and endings with its own names', () => {
    const e = startEconomy(other.economy!, ids, 6 * 60)
    expect(enact(e, { kind: 'festival' }, other.realm!).proclamation).toBe('¡Por orden del Alcalde, esta tarde hay fiesta en el muelle, con banquete y aguamiel para todos!')
    const s = freshStanding()
    s.unrest = 2
    const lines = dawnStanding(s, e, 0.1, 10, other).join(' ')
    expect(lines).toContain('contra el Alcalde y tomó el ayuntamiento')
    leaks(lines)
  })

  it('lets its own residents petition and think, in its own words', () => {
    const e = startEconomy(other.economy!, ids, 6 * 60)
    e.granary = 5
    for (const id of ids.slice(0, 5)) e.needs[id].daysHungry = 2
    const list = grievances({ content: other, economy: e, chronicle: [], minutes: 7 * 60 })
    expect(list.slice(0, 2).map((g) => [g.id, g.topic])).toEqual([
      ['agnes', 'hunger'],
      ['rowan', 'granary'],
    ])
    const input = musingInputFor(e, other.residents[0], { trust: 0.2, news: [], minutes: 11 * 60, world: other })
    for (const text of [petitionSystem(other), petitionPrompt(input, list[0]), musingSystem(other.name), rulesMusing(input, () => 0).thought, ...list.map((g) => g.fallback + g.wish)]) leaks(text)
  })
})

describe('the world registry', () => {
  it('runs the first world by default and finds each by id', () => {
    expect(WORLDS[0].content.id).toBe(content.id)
    for (const w of WORLDS) expect(worldById(w.content.id)).toBe(w)
    expect(worldById('nadie')).toBeUndefined()
  })
})
