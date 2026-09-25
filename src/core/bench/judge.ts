import type { Action } from '../decisions/types'
import type { WorldContent } from '../world/content'
import { createRng } from '../world/rng'
import type { BenchRun } from './run'
import type { Trial } from './runner'

/** What a judge model said about one decision: does it sound and act like this resident? */
export interface Judgment {
  contender: string
  scenario: string
  resident: string
  rep: number
  /** 1 (nothing like them) to 5 (exactly them); null when the judge could not answer. */
  score: number | null
  reason: string
  costUsd?: number
}

/** A judge's pass over a run, kept inside the run so it travels with it. */
export interface RunJudgment {
  judge: string
  at: number
  perContender: number
  judgments: Judgment[]
  costUsd: number
  costEstimated: boolean
}

export interface JudgeSummary {
  contender: string
  /** Average score, 1 to 5; null when nothing was judged. */
  mean: number | null
  judged: number
  failed: number
  /** The decisions the judge found least in character, worst first. */
  worst: Judgment[]
}

const ACTION_TEXT: Record<Action, string> = {
  go: 'ir al lugar',
  stay_home: 'quedarse en casa',
  warn: 'avisar a otros',
  investigate: 'ir a investigar',
  ignore: 'seguir con su día',
}

export const JUDGE_SYSTEM = `Evalúas personajes de una simulación: un pueblo de fantasía donde cada vecino tiene una personalidad y decide qué hacer ante un pregón.
Te doy la ficha del personaje, el pregón que oyó y lo que decidió, con su razonamiento y lo que dijo en voz alta.
Juzga solo si esa decisión y esas palabras son creíbles para ESTE personaje: su forma de hablar, lo que valora, lo que teme y sus rasgos. No juzgues si la decisión fue acertada.
Responde SOLO con un objeto JSON, sin texto antes ni después:
{ "score": 1 a 5, "reason": "una frase que diga qué encaja o qué desentona" }
5 = es exactamente este personaje; 3 = podría ser cualquiera; 1 = contradice al personaje. Escribe en español.`

/** The decisions a judge reads: the same sample every time for the same run, spread over announcements and residents. */
export function pickCases(run: BenchRun, perContender: number): Trial[] {
  const out: Trial[] = []
  for (const c of run.contenders) {
    if (c.kind === 'rules') continue
    const decided = run.trials.filter((t) => t.contender === c.id && t.action && t.reasoning)
    const rng = createRng(run.seed * 31 + c.id.length)
    const pool = [...decided]
    for (let i = 0; i < perContender && pool.length; i++) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0])
  }
  return out
}

export function judgePrompt(content: WorldContent, run: BenchRun, t: Trial): string {
  const r = content.residents.find((x) => x.id === t.resident)!
  const p = r.personality
  const scenario = run.scenarios.find((s) => s.id === t.scenario)
  return [
    `## Personaje: ${r.name}, ${r.occupation}, ${r.age} años`,
    r.bio,
    `Rasgos: ${r.traits.join(', ')}.${r.alignment ? ` Alineamiento: ${r.alignment}.` : ''}`,
    `Habla así: ${p.voice}`,
    `Valora: ${p.values.join(', ')}. Teme: ${p.fears.join(', ')}.`,
    '',
    '## El pregón que oyó',
    `«${scenario?.text ?? t.scenario}»`,
    '',
    '## Lo que decidió',
    `Acción: ${t.action ? ACTION_TEXT[t.action] : '—'}. ${t.believes ? 'Se lo cree.' : 'No se lo cree.'}`,
    `Dijo en voz alta: «${t.speech ?? ''}»`,
    `Su razonamiento: ${t.reasoning ?? ''}`,
  ].join('\n')
}

export function parseJudgment(text: string): { score: number; reason: string } | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw = JSON.parse(text.slice(start, end + 1)) as { score?: unknown; reason?: unknown }
    const score = Math.round(Number(raw.score))
    if (!(score >= 1 && score <= 5)) return null
    return { score, reason: typeof raw.reason === 'string' ? raw.reason.trim().slice(0, 300) : '' }
  } catch {
    return null
  }
}

export function summarizeJudgments(j: RunJudgment, contenders: string[]): JudgeSummary[] {
  return contenders.map((contender) => {
    const own = j.judgments.filter((x) => x.contender === contender)
    const scored = own.filter((x): x is Judgment & { score: number } => x.score !== null)
    return {
      contender,
      mean: scored.length ? scored.reduce((n, x) => n + x.score, 0) / scored.length : null,
      judged: scored.length,
      failed: own.length - scored.length,
      worst: [...scored].sort((a, b) => a.score - b.score).slice(0, 3),
    }
  })
}

/** One question to the judge model: the text it answered and what it cost. */
export type AskJudge = (prompt: string, signal: AbortSignal) => Promise<{ text: string; costUsd?: number; estimated?: boolean }>

/** Judges a run's sample a few at a time; a question that fails is kept as unanswered, and cancelling stops the pass. */
export async function runJudge(o: {
  run: BenchRun
  content: WorldContent
  judge: string
  perContender: number
  ask: AskJudge
  concurrency?: number
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
}): Promise<RunJudgment> {
  const cases = pickCases(o.run, o.perContender)
  const signal = o.signal ?? new AbortController().signal
  const judgments: Judgment[] = []
  let estimated = false
  let next = 0
  const worker = async () => {
    while (next < cases.length) {
      signal.throwIfAborted()
      const t = cases[next++]
      const base = { contender: t.contender, scenario: t.scenario, resident: t.resident, rep: t.rep }
      try {
        const reply = await o.ask(judgePrompt(o.content, o.run, t), signal)
        estimated ||= !!reply.estimated
        const parsed = parseJudgment(reply.text)
        judgments.push(parsed ? { ...base, ...parsed, costUsd: reply.costUsd } : { ...base, score: null, reason: 'La respuesta del juez no traía un puntaje válido.', costUsd: reply.costUsd })
      } catch (err) {
        if (signal.aborted) throw err
        judgments.push({ ...base, score: null, reason: err instanceof Error ? err.message : 'El juez no respondió.' })
      }
      o.onProgress?.(judgments.length, cases.length)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 3) }, worker))
  return { judge: o.judge, at: Date.now(), perContender: o.perContender, judgments, costUsd: judgments.reduce((n, j) => n + (j.costUsd ?? 0), 0), costEstimated: estimated }
}
