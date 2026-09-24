import { describe, expect, it } from 'vitest'
import { judgePrompt, parseJudgment, pickCases, runJudge, summarizeJudgments } from '../src/core/bench/judge'
import { compareSides } from '../src/core/bench/compare'
import { executeRun, type BenchRun } from '../src/core/bench/run'
import { createRulesProvider, mockDecision } from '../src/providers/mock'
import { content } from './helpers'

/** A run whose second contender passes for a model, so the judge has decisions with reasoning to read. */
async function run(): Promise<BenchRun> {
  const rules = (id: string, kind: string) => ({ contender: { id, label: id, provider: createRulesProvider(content.vocabulary), concurrency: 8, timeoutMs: 5000 }, info: { id, label: id, kind, model: id, host: '', concurrency: 8 } })
  return executeRun({ content, examples: content.examples.slice(0, 2), seed: 4, repetitions: 1, contenders: [rules('rules', 'rules'), rules('modelo', 'custom')], reference: (ctx) => mockDecision(ctx, content.vocabulary) })
}

describe('the judge of character', () => {
  it('reads the same sample every time, only from models, and shows it the resident and what they said', async () => {
    const r = await run()
    const cases = pickCases(r, 5)
    expect(cases).toHaveLength(5)
    expect(cases.every((t) => t.contender === 'modelo' && t.reasoning)).toBe(true)
    expect(pickCases(r, 5)).toEqual(cases)
    const prompt = judgePrompt(content, r, cases[0])
    const resident = content.residents.find((x) => x.id === cases[0].resident)!
    expect(prompt).toContain(resident.personality.voice)
    expect(prompt).toContain(cases[0].reasoning!)
  })

  it('reads scores from 1 to 5 and nothing else', () => {
    expect(parseJudgment('Veredicto: {"puntaje": 4, "razon": "Muy suyo."}')).toEqual({ score: 4, reason: 'Muy suyo.' })
    expect(parseJudgment('{"puntaje": 9}')).toBeNull()
    expect(parseJudgment('{"puntaje": "alto"}')).toBeNull()
    expect(parseJudgment('sin json')).toBeNull()
  })

  it('keeps the questions it could not answer, adds up the cost, and moves the comparison', async () => {
    const r = await run()
    let n = 0
    const verdict = await runJudge({
      run: r,
      content,
      judge: 'juez',
      perContender: 6,
      ask: async () => {
        n++
        if (n === 2) throw new Error('sin red')
        return { text: n === 3 ? 'nada' : '{"puntaje": 5, "razon": "Sí."}', costUsd: 0.01, estimated: true }
      },
      concurrency: 2,
    })
    expect(verdict.judgments).toHaveLength(6)
    const [s] = summarizeJudgments(verdict, ['modelo'])
    expect(s).toMatchObject({ judged: 4, failed: 2, mean: 5 })
    expect(verdict.costUsd).toBeCloseTo(0.05)
    expect(verdict.costEstimated).toBe(true)

    const judged = { ...r, judge: verdict }
    const worse = { ...r, judge: { ...verdict, judgments: verdict.judgments.map((j) => (j.score ? { ...j, score: 2 } : j)) } }
    const metric = compareSides({ run: judged, contender: 'modelo' }, { run: worse, contender: 'modelo' }).metrics.find((m) => m.id === 'judge')!
    expect(metric).toMatchObject({ base: 1, next: 0.25, verdict: 'worse' })
  })
})
