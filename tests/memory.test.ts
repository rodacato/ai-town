import { describe, expect, it } from 'vitest'
import { buildScenario } from '../src/core/bench/scenarios'
import { TownMemory, type MemoryEntry } from '../src/core/memory/memory'
import { bondLines, recallFor } from '../src/core/memory/recall'
import { buildContext } from '../src/core/reactions/context'
import { Simulation } from '../src/core/sim/simulation'
import { buildPrompt } from '../src/providers/llm/prompt'
import { mockDecision } from '../src/providers/mock'
import { announce, content, exampleByTone } from './helpers'

const lie = (id: string, minutes: number, believers: string[] = [], doubters: string[] = []): MemoryEntry => ({
  id,
  minutes,
  text: 'Banquete gratis',
  speaker: { kind: 'authority' },
  truth: false,
  summary: 'la Baronesa anunció un banquete y era mentira',
  believers,
  doubters,
})

describe('town memory', () => {
  it('scores a speaker from what came true, starting from a coin toss', () => {
    const m = new TownMemory()
    expect(m.reputation({ kind: 'authority' }).trust).toBe(0.5)
    m.record(lie('a', 100))
    m.record({ ...lie('b', 200), truth: true })
    m.record(lie('c', 300))
    expect(m.reputation({ kind: 'authority' })).toMatchObject({ truths: 1, lies: 2 })
    expect(m.reputation({ kind: 'authority' }).trust).toBeCloseTo(2 / 5)
    expect(m.reputation({ kind: 'stranger' }).trust).toBe(0.5)
  })

  it('keeps neighbours apart and ignores sightings in reputations', () => {
    const m = new TownMemory()
    m.record({ ...lie('a', 1), speaker: { kind: 'neighbor', residentId: 'kael' } })
    m.record({ ...lie('b', 2), speaker: { kind: 'sight' }, truth: true })
    expect(m.reputation({ kind: 'neighbor', residentId: 'kael' }).lies).toBe(1)
    expect(m.reputation({ kind: 'neighbor', residentId: 'finn' }).lies).toBe(0)
  })

  it('remembers whether each resident was fooled last time', () => {
    const m = new TownMemory([lie('a', 0, ['pip'], ['kael'])])
    const sim = new Simulation(content)
    const a = { ...announce(sim, exampleByTone('confiable')), minutes: 1500 }
    expect(recallFor(m, a, 'pip', 'La Baronesa')).toMatchObject({ lesson: -1 })
    expect(recallFor(m, a, 'pip', 'La Baronesa').personal).toMatch(/ayer.*te engañó/)
    expect(recallFor(m, a, 'kael', 'La Baronesa')).toMatchObject({ lesson: 1 })
    expect(recallFor(m, a, 'finn', 'La Baronesa').personal).toBeNull()
  })

  it('reaches the prompt when there is something to remember', () => {
    const sim = new Simulation(content)
    const a = announce(sim, exampleByTone('confiable'))
    const r = sim.residents.find((x) => x.profile.id === 'pip')!
    const empty = buildPrompt(buildContext(sim, a, r, [], null, new TownMemory()))
    expect(empty).not.toContain('Lo que recuerdas')
    const full = buildPrompt(buildContext(sim, a, r, [], null, new TownMemory([lie('a', 0, ['pip'])])))
    expect(full).toContain('Lo que recuerdas')
    expect(full).toContain('te engañó')
  })

  it('makes the town believe a speaker less after repeated lies', () => {
    const sim = new Simulation(content)
    const a = announce(sim, exampleByTone('confiable'))
    const everyone = sim.residents.map((r) => r.profile.id)
    const liar = new TownMemory([lie('a', 0, everyone), lie('b', 10, everyone), lie('c', 20, everyone)])
    const believing = (m?: TownMemory) => sim.residents.filter((r) => mockDecision(buildContext(sim, a, r, [], null, m), content.vocabulary).believes).length
    expect(believing(liar)).toBeLessThan(believing())
  })

  it('keeps the benchmark free of memory, so runs stay reproducible', () => {
    const scenario = buildScenario(content, content.examples[0], 7)
    expect(scenario.contexts.every((c) => c.memory === undefined)).toBe(true)
  })

  it('forgets things older than a month', () => {
    const m = new TownMemory([lie('old', 0)])
    m.record(lie('new', 40 * 1440))
    expect(m.entries.map((e) => e.id)).toEqual(['new'])
  })
})

describe('personal memory', () => {
  const sim = new Simulation(content)
  const heard = (id: string, truth: boolean, from: string, to: string, believers = [to]): MemoryEntry => ({ ...lie(id, 0, believers), truth, told: [{ from, to }] })

  it('holds a grudge against whoever passed on a lie it believed, and owes whoever warned it rightly', () => {
    const m = new TownMemory([heard('a', false, 'kael', 'pip'), heard('b', false, 'kael', 'pip'), heard('c', true, 'finn', 'pip'), heard('d', false, 'mara', 'pip', [])])
    expect(m.bondsOf('pip').get('kael')).toEqual({ misled: 2, warned: 0 })
    expect(m.bondsOf('pip').get('finn')).toEqual({ misled: 0, warned: 1 })
    expect(m.bondsOf('pip').has('mara')).toBe(false)
    expect(m.bondsOf('kael').size).toBe(0)
  })

  it('counts who fooled each resident with announcements', () => {
    const m = new TownMemory([lie('a', 0, ['pip']), lie('b', 10, ['pip', 'kael']), { ...lie('c', 20, ['pip']), speaker: { kind: 'stranger' } }])
    expect(m.fooled({ kind: 'authority' }, 'pip')).toBe(2)
    expect(m.foolers('pip').map((f) => [f.speaker.kind, f.times])).toEqual([['authority', 2], ['stranger', 1]])
    expect(m.foolers('finn')).toEqual([])
  })

  it('puts grudges and debts into the prompt and marks the rumors of known tellers', () => {
    const m = new TownMemory([heard('a', false, 'kael', 'pip'), heard('b', true, 'finn', 'pip')])
    const a = { ...announce(sim, exampleByTone('confiable')), minutes: 3000 }
    const pip = sim.residents.find((x) => x.profile.id === 'pip')!
    const recall = recallFor(m, a, 'pip', 'La Baronesa', (id) => id.toUpperCase())
    expect(recall.grudges).toEqual([{ id: 'kael', name: 'KAEL', times: 1 }])
    expect(recall.debts).toEqual([{ id: 'finn', name: 'FINN', times: 1 }])
    expect(bondLines(recall)).toHaveLength(2)
    const rumor = { fromId: 'kael', fromName: 'Kael', relation: null, message: '¡Corre!' }
    const prompt = buildPrompt(buildContext(sim, a, pip, [rumor], null, m))
    expect(prompt).toContain('Te pasaron mentiras que te creíste')
    expect(prompt).toContain('se lo debes')
    expect(prompt).toContain('«¡Corre!» (ya te pasó una mentira)')
  })

  it('makes a resident trust a rumor less from someone who lied to them before', () => {
    const a = announce(sim, exampleByTone('urgente'))
    const tellers = sim.residents.map((r) => r.profile.relationships[0]?.id ?? 'kael')
    const believing = (grudge: boolean) =>
      sim.residents.filter((r, i) => {
        const from = tellers[i]
        const m = new TownMemory(grudge ? [{ ...heard('x', false, from, r.profile.id), speaker: { kind: 'sight' } }] : [])
        const rumor = { fromId: from, fromName: from, relation: null, message: '¡Es cierto, vamos!' }
        return mockDecision(buildContext(sim, a, r, [rumor], null, m), content.vocabulary).believes
      }).length
    expect(believing(true)).toBeLessThan(believing(false))
  })

  it('warns first whoever warned it before', () => {
    const danger = announce(sim, exampleByTone('emergencia'))
    const warners = sim.residents.filter((r) => mockDecision(buildContext(sim, danger, r, [], null, new TownMemory()), content.vocabulary).action === 'warn')
    expect(warners.length).toBeGreaterThan(0)
    for (const r of warners) {
      const stranger = content.residents.find((x) => x.id !== r.profile.id && !r.profile.relationships.some((rel) => rel.id === x.id))!
      const m = new TownMemory([{ ...heard('x', true, stranger.id, r.profile.id), speaker: { kind: 'sight' } }])
      const d = mockDecision(buildContext(sim, danger, r, [], null, m), content.vocabulary)
      expect(d.action).toBe('warn')
      expect(d.tell[0]).toBe(stranger.id)
      expect(d.reasoning).toContain('Le debo a')
    }
  })
})
