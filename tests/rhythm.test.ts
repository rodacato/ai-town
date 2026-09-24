import { describe, expect, it } from 'vitest'
import { routineNow, staysIn } from '../src/core/sim/rhythm'
import { Simulation } from '../src/core/sim/simulation'
import type { Weather } from '../src/core/sim/weather'
import { content } from './helpers'

/** Runs the town for a while at a given hour and weather, and counts who is outside. */
function outsideAfter(hour: number, weather: Weather, seconds = 240) {
  const sim = new Simulation(content, 3)
  sim.setHour(hour)
  sim.weather = weather
  let outside = 0
  let samples = 0
  for (let t = 0; t < seconds; t += 0.1) {
    sim.update(0.1)
    // Keep the clock at that hour so the test measures the hour, not the drift.
    if (t % 5 < 0.1) sim.setHour(hour)
    if (t > seconds / 2) {
      outside += sim.residents.filter((r) => r.mode !== 'inside').length
      samples++
    }
  }
  return outside / samples
}

describe('town rhythm', () => {
  it('empties the streets at night except for the night owls', () => {
    const noon = outsideAfter(12, 'clear')
    const night = outsideAfter(23, 'clear')
    const owls = content.residents.filter((r) => r.nightRoutine).length
    expect(night).toBeLessThan(noon / 2)
    expect(night).toBeLessThanOrEqual(owls + 1)
  })

  it('sends people indoors in a storm', () => {
    expect(outsideAfter(12, 'storm')).toBeLessThan(outsideAfter(12, 'clear'))
  })

  it('bends a routine towards home in the evening, in foul weather and in winter', () => {
    const p = content.residents.find((r) => !r.nightRoutine)!
    const noon = routineNow(p, 12 * 60, 'clear', 'summer')
    expect(routineNow(p, 20 * 60, 'clear', 'summer').home ?? 0).toBeGreaterThan(noon.home ?? 0)
    expect(routineNow(p, 12 * 60, 'rain', 'summer').home ?? 0).toBeGreaterThan(noon.home ?? 0)
    expect(routineNow(p, 12 * 60, 'clear', 'winter').home ?? 0).toBeGreaterThan(noon.home ?? 0)
    expect(staysIn(p, 3 * 60)).toBe(true)
    expect(staysIn(content.residents.find((r) => r.nightRoutine)!, 3 * 60)).toBe(false)
  })
})
