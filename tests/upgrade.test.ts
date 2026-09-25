import { describe, expect, it } from 'vitest'
import { upgradeRunText } from '../src/core/bench/run'
import { readRuns } from '../src/core/bench/bundle'
import { asDifficulty } from '../src/core/realm/difficulty'
import { freshStanding, upgradeStanding } from '../src/core/realm/standing'
import { byRules, viaLabel } from '../src/app/via'

/** What was saved before the code went English has to keep loading. */
describe('saved data from before the code went English', () => {
  it('turns Spanish tones and contender id suffixes of a saved run into today’s', () => {
    const old = JSON.stringify({ scenarios: [{ id: 'a', tone: 'confiable' }, { id: 'b', tone: 'emergencia' }], durations: { 'anthropic:claude-x:sin-cache': 1, 'shellm:claude:esfuerzo-low': 2 } })
    const next = JSON.parse(upgradeRunText(old))
    expect(next.scenarios.map((s: { tone: string }) => s.tone)).toEqual(['trusted', 'emergency'])
    expect(Object.keys(next.durations)).toEqual(['anthropic:claude-x:no-cache', 'shellm:claude:effort-low'])
    expect(upgradeRunText('{"text":"sin-cache y confiable"}')).toBe('{"text":"sin-cache y confiable"}')
  })

  it('upgrades runs read from a file', () => {
    const run = { format: 'ai-town-bench/1', id: 'r', trials: [], report: { contenders: [] }, scenarios: [{ id: 'a', tone: 'sospechoso' }] }
    const [read] = readRuns(JSON.stringify(run))
    expect(read.scenarios[0].tone).toBe('suspicious')
  })

  it('reads the old hard difficulty and anything unknown as normal', () => {
    expect(asDifficulty('dura')).toBe('hard')
    expect(asDifficulty('cruel')).toBe('cruel')
    expect(asDifficulty('imposible')).toBe('normal')
  })

  it('gives an old ending its kind back from the title', () => {
    const old = { ...freshStanding(), end: { title: 'Revuelta', won: false, text: '…', day: 9 } } as never
    expect(upgradeStanding(old).end?.kind).toBe('revolt')
    expect(upgradeStanding(freshStanding())).toEqual(freshStanding())
  })

  it('still knows a call answered by the rules under its old name', () => {
    expect(byRules('rules') && byRules('reglas')).toBe(true)
    expect(byRules('claude (shellm)')).toBe(false)
    expect(viaLabel('rules')).toBe('reglas')
  })
})
