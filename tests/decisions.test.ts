import { describe, expect, it } from 'vitest'
import { buildContext } from '../src/core/reactions/context'
import { mockDecision } from '../src/providers/mock'
import { partialStringField, parseDecision } from '../src/providers/llm/parse'
import { EXAMPLES } from '../src/worlds/serena/announcements'
import { detectPlace } from '../src/core/reactions/announcement'
import { Simulation } from '../src/core/sim/simulation'

const sim = new Simulation()

function decideAll(exampleId: string) {
  const ex = EXAMPLES.find((e) => e.id === exampleId)!
  const a = { id: ex.id, text: ex.text, speaker: ex.speaker, place: detectPlace(ex.text), minutes: 630 }
  return sim.residents
    .filter((r) => !(ex.speaker.kind === 'neighbor' && ex.speaker.residentId === r.profile.id))
    .map((r) => mockDecision(buildContext(a, r, 630, [], null)))
}

describe('mock decisions', () => {
  it('produce varied, well-formed reactions for every example', () => {
    for (const ex of EXAMPLES) {
      const decisions = decideAll(ex.id)
      const actions = new Set(decisions.map((d) => d.action))
      expect(actions.size, ex.id).toBeGreaterThan(1)
      for (const d of decisions) {
        expect(d.reasoning.length).toBeGreaterThan(20)
        expect(d.speech.length).toBeGreaterThan(0)
        if (d.action === 'warn') expect(d.tell.length).toBeGreaterThan(0)
      }
    }
  })

  it('mostly distrusts the suspicious stranger', () => {
    const decisions = decideAll('money')
    expect(decisions.filter((d) => d.believes).length).toBeLessThan(decisions.length / 3)
  })

  it('mostly shelters from the storm', () => {
    const decisions = decideAll('storm')
    expect(decisions.filter((d) => d.action === 'stay_home' || d.action === 'warn').length).toBeGreaterThan(decisions.length / 2)
  })
})

describe('announcement place detection', () => {
  it('uses the earliest mention', () => {
    expect(detectPlace('Nos vemos en la fuente de la plaza')).toBe('fountain')
    expect(detectPlace('El puente del río está roto')).toBe('bridge')
    expect(detectPlace('Todo bien por aquí')).toBeNull()
  })
})

describe('LLM output parsing', () => {
  const ctx = { townsfolk: [{ id: 'marta', name: 'Marta Quiroga' }] } as Parameters<typeof parseDecision>[1]

  it('streams a string field from incomplete JSON', () => {
    const json = '{"reasoning": "Hola \\"amigos\\", voy'
    expect(partialStringField(json, 'reasoning')).toBe('Hola "amigos", voy')
  })

  it('parses fenced JSON and maps names to ids', () => {
    const d = parseDecision('```json\n{"reasoning":"x","action":"warn","believes":false,"tell":["Marta","nadie"],"speech":"¡Ojo!","emoji":"📣","confidence":0.7}\n```', ctx)
    expect(d).toMatchObject({ action: 'warn', believes: false, tell: ['marta'], confidence: 0.7 })
  })

  it('rejects text without JSON', () => {
    expect(() => parseDecision('no sé', ctx)).toThrow()
  })
})
