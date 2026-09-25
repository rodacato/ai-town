import { describe, expect, it } from 'vitest'
import { buildContext } from '../src/core/reactions/context'
import { detectPlace } from '../src/core/reactions/announcement'
import { Simulation } from '../src/core/sim/simulation'
import type { Example } from '../src/core/world/content'
import { partialStringField, parseDecision } from '../src/providers/llm/parse'
import { buildPrompt, buildPromptParts } from '../src/providers/llm/prompt'
import { SCALES } from '../src/core/world/content'
import { mockDecision } from '../src/providers/mock'
import { announce, content, exampleByTone } from './helpers'

const sim = new Simulation(content)

function decideAll(ex: Example) {
  const a = announce(sim, ex)
  return sim.residents
    .filter((r) => !(ex.speaker.kind === 'neighbor' && ex.speaker.residentId === r.profile.id))
    .map((r) => mockDecision(buildContext(sim, a, r, [], null), content.vocabulary))
}

describe('mock decisions', () => {
  it('produce varied, well-formed reactions for every example', () => {
    for (const ex of content.examples) {
      const decisions = decideAll(ex)
      expect(new Set(decisions.map((d) => d.action)).size, ex.id).toBeGreaterThan(1)
      for (const d of decisions) {
        expect(d.reasoning.length).toBeGreaterThan(20)
        expect(d.speech.length).toBeGreaterThan(0)
        if (d.action === 'warn') expect(d.tell.length).toBeGreaterThan(0)
      }
    }
  })

  it('mostly distrusts the suspicious example', () => {
    const decisions = decideAll(exampleByTone('suspicious'))
    expect(decisions.filter((d) => d.believes).length).toBeLessThan(decisions.length / 3)
  })

  it('mostly shelters on the emergency example', () => {
    const decisions = decideAll(exampleByTone('emergency'))
    expect(decisions.filter((d) => d.action === 'stay_home' || d.action === 'warn').length).toBeGreaterThan(decisions.length / 2)
  })

  it('mostly believes the trusted example', () => {
    const decisions = decideAll(exampleByTone('trusted'))
    expect(decisions.filter((d) => d.believes).length).toBeGreaterThan(decisions.length / 2)
  })
})

describe('personalities', () => {
  it('give every resident a voice, drives, a secret and five scales in 0–1', () => {
    for (const r of content.residents) {
      const p = r.personality
      expect(p.voice.length, r.id).toBeGreaterThan(10)
      expect(p.values.length, r.id).toBeGreaterThan(0)
      expect(p.fears.length, r.id).toBeGreaterThan(0)
      expect(p.secret.length, r.id).toBeGreaterThan(10)
      for (const k of SCALES) expect(p.scales[k], `${r.id}.${k}`).toBeGreaterThanOrEqual(0), expect(p.scales[k], `${r.id}.${k}`).toBeLessThanOrEqual(1)
    }
  })

  it('reach the model prompt', () => {
    const r = sim.residents[0]
    const prompt = buildPrompt(buildContext(sim, announce(sim, content.examples[0]), r, [], null))
    expect(prompt).toContain(r.profile.personality.voice)
    expect(prompt).toContain(r.profile.personality.secret)
    expect(prompt).toContain('Valentía')
  })

  it('open every prompt of an announcement with the same text, so the cache can reuse it', () => {
    const a = announce(sim, content.examples[0])
    const parts = sim.residents.map((r) => buildPromptParts(buildContext(sim, a, r, [], null)))
    expect(new Set(parts.map((p) => p.shared)).size).toBe(1)
    expect(new Set(parts.map((p) => p.own)).size).toBe(parts.length)
    expect(parts[0].shared).toContain(a.text)
    for (const [i, r] of sim.residents.entries()) {
      expect(parts[i].shared).toContain(r.profile.id)
      expect(parts[i].own).toContain(r.profile.personality.voice)
    }
  })

  it('make the bravest resident face danger and the most timid one hide from it', () => {
    const dragon = exampleByTone('emergency')
    const decisions = new Map(sim.residents.map((r, i) => [r.profile.id, decideAll(dragon)[i]]))
    const byBravery = [...content.residents].sort((a, b) => a.personality.scales.bravery - b.personality.scales.bravery)
    expect(decisions.get(byBravery.at(-1)!.id)!.action).toBe('investigate')
    // Warning others on a stay-home order means telling them and then going home too.
    expect(['stay_home', 'warn']).toContain(decisions.get(byBravery[0].id)!.action)
  })
})

describe('announcement place detection', () => {
  const [first, second] = sim.world.places.filter((p) => p.keywords.length)

  it('uses the earliest mention', () => {
    expect(detectPlace(`Nos vemos en ${first.keywords[0]} y luego en ${second.keywords[0]}`, sim.world.places, content.homeKeywords)).toBe(first.id)
    expect(detectPlace(`Primero ${second.keywords[0]}, después ${first.keywords[0]}`, sim.world.places, content.homeKeywords)).toBe(second.id)
  })

  it('returns null when no place is named', () => {
    expect(detectPlace('Todo bien por aquí', sim.world.places, content.homeKeywords)).toBeNull()
  })

  it('detects staying home', () => {
    expect(detectPlace(`Vuelvan a su ${content.homeKeywords[0]}`, sim.world.places, content.homeKeywords)).toBe('home')
  })
})

describe('LLM output parsing', () => {
  const ctx = { townsfolk: [{ id: 'marta', name: 'Marta Quiroga' }] } as Parameters<typeof parseDecision>[1]

  it('streams a string field from incomplete JSON', () => {
    expect(partialStringField('{"reasoning": "Hola \\"amigos\\", voy', 'reasoning')).toBe('Hola "amigos", voy')
  })

  it('parses fenced JSON and maps names to ids', () => {
    const d = parseDecision('```json\n{"reasoning":"x","action":"warn","believes":false,"tell":["Marta","nadie"],"speech":"¡Ojo!","emoji":"📣","confidence":0.7}\n```', ctx)
    expect(d).toMatchObject({ action: 'warn', believes: false, tell: ['marta'], confidence: 0.7 })
  })

  it('rejects text without JSON', () => {
    expect(() => parseDecision('no sé', ctx)).toThrow()
  })
})
