import { describe, expect, it } from 'vitest'
import { buildContext } from '../src/core/reactions/context'
import { eventAt, react } from '../src/core/reactions/outcome'
import { Simulation } from '../src/core/sim/simulation'
import { SEASON_TEXT } from '../src/core/sim/season'
import { WEATHER_TEXT } from '../src/core/sim/weather'
import { isWalkable } from '../src/core/world/world'
import { buildPrompt } from '../src/providers/llm/prompt'
import { mockDecision } from '../src/providers/mock'
import { announce, content, exampleByTone } from './helpers'

describe('god panel', () => {
  it('jumps to an hour without changing the day', () => {
    const sim = new Simulation(content)
    const day = Math.floor(sim.minutes / 1440)
    sim.setHour(22)
    expect(sim.minutes).toBe(day * 1440 + 22 * 60)
  })

  it('puts events on an open tile in front of their place, never inside a tree or wall', () => {
    const sim = new Simulation(content)
    for (const place of ['plaza', 'bridge', 'forest', 'crypt']) {
      const e = eventAt(content, sim.world.places, 'feast', place)
      const tile = sim.world.tiles[Math.floor(e.at.y)][Math.floor(e.at.x)]
      expect(isWalkable(tile), place).toBe(true)
      expect(e.summary.length).toBeGreaterThan(5)
    }
  })

  it('sends people near a threat home and draws them towards something good', () => {
    const sim = new Simulation(content)
    const fire = eventAt(content, sim.world.places, 'fire', 'plaza')
    for (const r of sim.residents) Object.assign(r, { x: fire.at.x, y: fire.at.y, mode: 'idle', tasks: [] })
    react(sim, fire)
    expect(sim.residents.every((r) => r.tasks[0]?.label === 'Huye despavorido')).toBe(true)
    const feast = eventAt(content, sim.world.places, 'feast', 'plaza')
    for (const r of sim.residents) Object.assign(r, { tasks: [] })
    react(sim, feast)
    expect(sim.residents.every((r) => r.tasks[0]?.kind === 'walk')).toBe(true)
  })

  it('leaves busy residents to what they were doing', () => {
    const sim = new Simulation(content)
    const fire = eventAt(content, sim.world.places, 'fire', 'plaza')
    for (const r of sim.residents) Object.assign(r, { x: fire.at.x, y: fire.at.y, mode: 'idle', tasks: [] })
    react(sim, fire, () => true)
    expect(sim.residents.every((r) => r.tasks.length === 0)).toBe(true)
  })

  it('tells the model what the weather is like', () => {
    const sim = new Simulation(content)
    sim.weather = 'storm'
    const ctx = buildContext(sim, announce(sim, exampleByTone('confiable')), sim.residents[0], [], null)
    expect(buildPrompt(ctx)).toContain(WEATHER_TEXT.storm.sentence)
  })

  it('tells the model the season, and goes back to summer on reset', () => {
    const sim = new Simulation(content)
    sim.season = 'winter'
    const ctx = buildContext(sim, announce(sim, exampleByTone('confiable')), sim.residents[0], [], null)
    expect(buildPrompt(ctx)).toContain(SEASON_TEXT.winter.sentence)
    sim.reset()
    expect(sim.season).toBe('summer')
  })

  it('keeps the timid away from a feast in foul weather', () => {
    const sim = new Simulation(content)
    const a = announce(sim, exampleByTone('confiable'))
    const decide = (weather: 'clear' | 'snow') => {
      sim.weather = weather
      return sim.residents.map((r) => mockDecision(buildContext(sim, a, r, [], null), content.vocabulary).action)
    }
    const goingClear = decide('clear').filter((x) => x === 'go').length
    const goingSnow = decide('snow').filter((x) => x === 'go').length
    expect(goingSnow).toBeLessThan(goingClear)
  })
})
