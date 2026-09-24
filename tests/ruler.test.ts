import { describe, expect, it } from 'vitest'
import { startEconomy } from '../src/core/economy/economy'
import { TownMemory } from '../src/core/memory/memory'
import { Chronicle } from '../src/core/realm/chronicle'
import { fateCalendar, runReign } from '../src/core/realm/reign'
import { buildReport, reportText } from '../src/core/realm/report'
import { MAX_ACTIONS, parseRulerTurn, rulesRuler } from '../src/core/realm/ruler'
import { createModelRuler } from '../src/providers/ruler'
import type { ChatStream } from '../src/providers/llm/client'
import { DEFAULT_SETTINGS } from '../src/providers/llm/config'
import { content } from './helpers'

const ids = content.residents.map((r) => r.id)
const report = (tweak: (e: ReturnType<typeof startEconomy>) => void = () => {}, chronicle = new Chronicle()) => {
  const e = startEconomy(content.economy!, ids, 6 * 60)
  tweak(e)
  return buildReport({ content, economy: e, memory: new TownMemory(), chronicle: chronicle.entries, minutes: 6 * 60 + 1440, season: 'summer', weather: 'clear', day: 1, seed: 7 })
}

describe('the royal report', () => {
  it('gives exact coffers, rough spirits and petitions that follow the town', () => {
    const calm = report()
    expect(calm).toMatchObject({ treasury: 120, granary: 60, hungry: 0, petitions: [] })
    const grim = report((e) => {
      e.granary = 10
      e.taxRate = 0.4
      for (const id of ids.slice(0, 5)) e.needs[id].daysHungry = 2
    })
    expect(grim.petitions.map((p) => p.from)).toEqual(expect.arrayContaining(['Hermana Clemencia', 'Godric', 'Bartolo']))
    expect(reportText(grim)).toContain('Peticiones')
  })

  it('carries the last day of news, some of it as exaggerated hearsay, the same for the same seed', () => {
    const c = new Chronicle()
    for (let i = 0; i < 8; i++) c.add(6 * 60 + 1440 - 300 + i, 'event', `El ladrón robó ${10 + i} monedas.`)
    const a = report(undefined, c).news
    const b = report(undefined, c).news
    expect(a).toEqual(b)
    expect(a.some((n) => n.startsWith('Dicen por ahí'))).toBe(true)
  })
})

describe('reading the Baroness', () => {
  it('turns her JSON into actions and keeps what it cannot read as problems', () => {
    const turn = parseRulerTurn(
      'Claro.\n' +
        JSON.stringify({
          pensamiento: 'Llega el invierno.',
          acciones: [
            { tipo: 'comprar_comida', raciones: 60 },
            { tipo: 'pregonar', texto: 'Hay grano para todos', cierto: false },
            { tipo: 'ley', nombre: 'inventada', activa: true },
            { tipo: 'fiesta' },
          ],
        }),
    )
    expect(turn.thought).toBe('Llega el invierno.')
    expect(turn.actions).toEqual([
      { kind: 'decree', decree: { kind: 'buyFood', rations: 60 } },
      { kind: 'proclaim', text: 'Hay grano para todos', honest: false },
    ])
    expect(turn.problems.join(' ')).toMatch(/inventada.*Pidió 4 acciones/)
    expect(parseRulerTurn('no sé').problems).toHaveLength(1)
  })

  it('never takes more than the allowed actions', () => {
    const many = { acciones: Array.from({ length: 6 }, () => ({ tipo: 'repartir_comida' })) }
    expect(parseRulerTurn(JSON.stringify(many)).actions).toHaveLength(MAX_ACTIONS)
  })

  it('asks a model once per report and counts what it costs', async () => {
    const reply = JSON.stringify({ pensamiento: 'Todo bien.', acciones: [{ tipo: 'pedir_al_creador', texto: 'Quiero un puerto.' }] })
    const stream: ChatStream = async function* () {
      yield { type: 'delta', text: reply }
      yield { type: 'done', usage: { inputTokens: 900, outputTokens: 80, costUsd: 0.002 } }
    }
    const ruler = createModelRuler({ ...DEFAULT_SETTINGS.connections.shellm, model: 'claude' }, stream)
    const out = await ruler(report(), new AbortController().signal)
    expect(out.actions).toEqual([{ kind: 'ask', text: 'Quiero un puerto.' }])
    expect(out.usage?.costUsd).toBe(0.002)
    expect(out.prompt).toContain('Informe del castillo')
  })
})

describe('ruling by rules', () => {
  it('feeds the hungry and stocks up when the granary runs low', () => {
    const hungry = rulesRuler(report((e) => ids.slice(0, 4).forEach((id) => (e.needs[id].daysHungry = 1))))
    expect(hungry.actions[0]).toEqual({ kind: 'decree', decree: { kind: 'handout' } })
    const low = rulesRuler(report((e) => (e.granary = 20)))
    expect(low.actions.some((a) => a.kind === 'decree' && a.decree.kind === 'buyFood')).toBe(true)
  })

  it('carries the town through a year that ruins an absent ruler', async () => {
    const base = { content, days: 40, seed: 12, seasonLength: 10, fate: fateCalendar(12, 40) }
    const absent = await runReign({ ...base, rule: async () => ({ thought: '', actions: [], problems: [] }) })
    const ruled = await runReign({ ...base, rule: async (r) => rulesRuler(r) })
    expect(absent.deaths + absent.departures).toBeGreaterThan(0)
    expect(ruled.deaths + ruled.departures).toBeLessThan(absent.deaths + absent.departures)
    expect(ruled.survivedDays).toBe(40)
    expect(ruled.ending?.won).toBe(true)
  })

  it('topples a ruler who keeps lying', async () => {
    const liar = await runReign({
      content,
      days: 20,
      seed: 3,
      seasonLength: 7,
      fate: [],
      rule: async () => ({ thought: '', actions: [{ kind: 'proclaim', text: 'Todo va de maravilla', honest: false }], problems: [] }),
    })
    expect(liar.revolt).toBe(true)
    expect(liar.lies).toBeGreaterThan(3)
  })
})
