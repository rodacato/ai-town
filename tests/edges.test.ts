import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startEconomy } from '../src/core/economy/economy'
import { enact } from '../src/core/realm/decrees'
import { ranking, scoreReign, type ReignSummary } from '../src/core/realm/duel'
import { dueFate, splitDue } from '../src/core/realm/fate'
import { musingInputFor, parseMusing, rulesMusing } from '../src/core/realm/musing'
import { parseRulerTurn } from '../src/core/realm/ruler'
import type { FateEvent } from '../src/core/realm/reign'
import { roundSummary } from '../src/core/reactions/round'
import type { Reaction } from '../src/core/reactions/engine'
import { Simulation } from '../src/core/sim/simulation'
import type { ChatStream } from '../src/providers/llm/client'
import { DEFAULT_SETTINGS } from '../src/providers/llm/config'
import { openKeys, sealKeys } from '../src/providers/llm/vault'
import { modelMusing } from '../src/providers/musing'
import { loadMemory } from '../src/app/memoryStorage'
import { restoreTown, saveTown } from '../src/app/townState'
import { content, memoryStorage } from './helpers'

const ids = content.residents.map((r) => r.id)
const town = () => startEconomy(content.economy!, ids, 6 * 60)

describe('fate and events in course', () => {
  const calendar: FateEvent[] = [{ day: 2, hour: 14, visual: 'wolves', place: 'forest', text: 'Lobos.' }]

  it('strikes once, on its day, not before its hour', () => {
    expect(dueFate(calendar, 2, 13.9, -1)).toBeUndefined()
    expect(dueFate(calendar, 2, 14, -1)).toBe(calendar[0])
    expect(dueFate(calendar, 2, 20, 2)).toBeUndefined()
    expect(dueFate(calendar, 3, 20, -1)).toBeUndefined()
  })

  it('settles only the events whose time is up', () => {
    const { due, going } = splitDue([{ until: 100 }, { until: 200 }], 150)
    expect(due).toEqual([{ until: 100 }])
    expect(going).toEqual([{ until: 200 }])
  })
})

describe('a round of decisions', () => {
  const reaction = (id: string, patch: Partial<Reaction>): Reaction =>
    ({ id, isSpeaker: false, decision: null, error: null, calls: [], ...patch }) as Reaction
  const call = (totalMs: number, costUsd?: number, source?: 'host' | 'table') => ({ provider: 'x', at: 0, queueMs: 0, ttftMs: null, totalMs, usage: { inputTokens: 100, outputTokens: 10, costUsd, costSource: source }, action: null, believes: null, error: null, revision: false })

  it('sums what it cost, takes the median time and counts actions, leaving the speaker out', () => {
    const r = roundSummary([
      reaction('a', { decision: { action: 'go' } as Reaction['decision'], calls: [call(1000, 0.01, 'table')] }),
      reaction('b', { decision: { action: 'go' } as Reaction['decision'], calls: [call(3000, 0.02, 'table')] }),
      reaction('c', { error: 'timeout', calls: [call(9000)] }),
      reaction('speaker', { isSpeaker: true, calls: [call(1)] }),
    ])
    expect(r).toMatchObject({ total: 3, decided: 2, errors: 1, calls: 3, medianMs: 3000, costEstimated: true, tokensIn: 300, tokensOut: 30, actions: [['go', 2]] })
    expect(r.costUsd).toBeCloseTo(0.03)
  })
})

describe('the Baroness in the margins', () => {
  it('rejects decrees with values that are not numbers', () => {
    const turn = parseRulerTurn('{"pensamiento": "x", "acciones": [{"tipo": "impuesto", "porcentaje": "mucho"}, {"tipo": "precio_racion", "monedas": "dos"}]}')
    const e = town()
    const before = { ...e }
    for (const a of turn.actions) if (a.kind === 'decree') expect(enact(e, a.decree, content.realm!).ok).toBe(false)
    expect(e.taxRate).toBe(before.taxRate)
    expect(e.foodPrice).toBe(before.foodPrice)
  })

  it('reads JSON after prose, and says what was wrong', () => {
    const turn = parseRulerTurn('Pienso que {"pensamiento": "bien", "acciones": [{"tipo": "pedir_al_creador"}, {"tipo": "volar"}]}')
    expect(turn.thought).toBe('bien')
    expect(turn.problems).toEqual(['Una carta sin texto.', 'Acción desconocida: «volar».'])
    expect(parseRulerTurn('{"pensamiento": "x", "acciones": "ninguna"}').problems).toContain('Faltaba la lista de acciones.')
    expect(parseRulerTurn(`{"acciones": [{"tipo": "pregonar", "texto": "${'a'.repeat(300)}"}]}`).actions[0]).toMatchObject({ text: 'a'.repeat(200) })
  })
})

describe('a resident thinking, in the margins', () => {
  it('keeps the thought, the emoji and the mood within bounds', () => {
    const m = parseMusing(`{"pensamiento": "${'b'.repeat(300)}", "animo": "abc", "emoji": "😀😀😀😀"}`)!
    expect(m.thought).toHaveLength(240)
    expect(m.mood).toBe(0)
    expect([...m.emoji]).toHaveLength(2)
    expect(parseMusing('{"pensamiento": "hola"}')!.emoji).toBe('💭')
  })

  it('worries about money, taxes, laws and trust in turn, and talks about the news', () => {
    const e = town()
    const input = musingInputFor(e, content.residents[0], { trust: 0.5, news: [], minutes: 11 * 60, world: content })
    const first = () => 0
    expect(rulesMusing({ ...input, coins: 1 }, first).emoji).toBe('🪙')
    expect(rulesMusing({ ...input, taxRate: 0.4 }, first).emoji).toBe('😤')
    expect(rulesMusing({ ...input, laws: ['toque de queda', 'racionamiento'] }, first).mood).toBe(-1)
    expect(rulesMusing({ ...input, trust: 0.2 }, first).emoji).toBe('🤨')
    expect(rulesMusing({ ...input, needs: { ...input.needs, mood: 0.5 }, news: ['Llegó una caravana.'] }, first).mood).toBe(1)
    expect(input.hour).toBe(11)
  })

  it('falls back to rules when the model answers nonsense, and still counts the cost', async () => {
    const stream: ChatStream = async function* () {
      yield { type: 'delta', text: 'no sé' }
      yield { type: 'done', usage: { inputTokens: 1_000_000, outputTokens: 0 } }
    }
    const input = musingInputFor(town(), content.residents[0], { trust: 0.5, news: [], minutes: 600, world: content })
    const reply = await modelMusing({ ...DEFAULT_SETTINGS.connections.anthropic, model: 'claude-haiku-4-5' }, input, new AbortController().signal, stream)
    expect(reply.fellBack).toBe(true)
    expect(reply.usage).toMatchObject({ costUsd: 1, costSource: 'table' })
  })
})

describe('the duel score', () => {
  const base: ReignSummary = { ruler: 'a', ending: 'Sobrevivió un año', won: true, survivedDays: 41, population: 20, deaths: 0, departures: 0, heists: 0, stolen: 0, trust: 0.5, mood: 0.5, treasury: 0, lies: 0, proclamations: 0, letters: [], problems: 0, errors: 0, costUsd: 0, score: 0 }

  it('rewards prosperity, punishes heists, and breaks ties by cost', () => {
    expect(scoreReign({ ...base, ending: 'Año de prosperidad' })).toBe(scoreReign(base) + 15)
    expect(scoreReign({ ...base, heists: 2 })).toBe(scoreReign(base) - 10)
    const cheap = { ...base, ruler: 'barato', score: 100, costUsd: 0.1 }
    const dear = { ...base, ruler: 'caro', score: 100, costUsd: 0.5 }
    expect(ranking([dear, cheap]).map((r) => r.ruler)).toEqual(['barato', 'caro'])
  })
})

describe('storage that went wrong', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('ignores a corrupt or future save and leaves the town as it was', () => {
    const sim = new Simulation(content, 1)
    const treasury = sim.economy!.treasury
    localStorage.setItem(`ai-town:state:${content.id}`, '{roto')
    expect(restoreTown(content.id, sim)).toBeNull()
    localStorage.setItem(`ai-town:state:${content.id}`, JSON.stringify({ v: 2 }))
    expect(restoreTown(content.id, sim)).toBeNull()
    expect(sim.economy!.treasury).toBe(treasury)
  })

  it('brings back an old save that knew fewer laws', () => {
    const sim = new Simulation(content, 1)
    sim.economy!.laws.curfew = true
    saveTown(content.id, sim)
    const saved = JSON.parse(localStorage.getItem(`ai-town:state:${content.id}`)!)
    delete saved.economy.laws.levy
    localStorage.setItem(`ai-town:state:${content.id}`, JSON.stringify(saved))
    const back = new Simulation(content, 2)
    restoreTown(content.id, back)
    expect(back.economy!.laws).toEqual({ curfew: true, rationing: false, levy: false })
  })

  it('starts the memory empty when what was saved is unreadable', () => {
    localStorage.setItem(`ai-town:memory:${content.id}`, '{"entries": "nope"}')
    expect(loadMemory(content.id).entries).toEqual([])
    localStorage.setItem(`ai-town:memory:${content.id}`, 'nada')
    expect(loadMemory(content.id).entries).toEqual([])
  })

  it('rejects a tampered vault with the same message as a wrong passphrase', async () => {
    await sealKeys({ anthropic: 'sk' }, 'frase correcta')
    const sealed = JSON.parse(localStorage.getItem('ai-town:key-vault')!)
    const data = sealed.data as string
    sealed.data = (data[0] === 'A' ? 'B' : 'A') + data.slice(1)
    localStorage.setItem('ai-town:key-vault', JSON.stringify(sealed))
    await expect(openKeys('frase correcta')).rejects.toThrow('La frase no es correcta.')
  })
})
