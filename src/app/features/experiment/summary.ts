import type { Reaction } from '../../../core/reactions/engine'
import { ACTIONS, type Action } from '../../../core/decisions/types'
import { PLACE_LABEL, toPlace } from '../../../worlds/serena/announcements'
import { RESIDENTS } from '../../../worlds/serena/residents'
import type { Announcement } from '../../../core/reactions/announcement'

export const firstName = (id: string) => RESIDENTS.find((r) => r.id === id)?.name.split(' ')[0] ?? id
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] ?? ''))
export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export interface Stats {
  listeners: Reaction[]
  decided: Reaction[]
  counts: Record<Action, number>
  believers: number
  latencies: number[]
  median: number | null
  slowest: Reaction | null
}

export function computeStats(reactions: Record<string, Reaction>): Stats {
  const listeners = Object.values(reactions).filter((r) => !r.isSpeaker)
  const decided = listeners.filter((r) => r.phase === 'decided' && r.decision)
  const counts = Object.fromEntries(ACTIONS.map((a) => [a, 0])) as Record<Action, number>
  for (const r of decided) counts[r.decision!.action]++
  const latencies = decided.map((r) => r.latencyMs ?? 0).sort((a, b) => a - b)
  const median = latencies.length ? latencies[Math.floor((latencies.length - 1) / 2)] : null
  const slowest = decided.reduce<Reaction | null>((a, r) => (!a || (r.latencyMs ?? 0) > (a.latencyMs ?? 0) ? r : a), null)
  return { listeners, decided, counts, believers: decided.filter((r) => r.decision!.believes).length, latencies, median, slowest }
}

const HEADLINE: Record<Action, (n: number, total: number, place: string) => string> = {
  go: (n, t, place) => `${n} de ${t} fueron ${toPlace(place)}`,
  stay_home: (n, t) => `${n} de ${t} se resguardaron en casa`,
  warn: (n, t) => `${n} de ${t} corrieron a avisar a otros`,
  investigate: (n, t) => `${n} de ${t} fueron a investigar`,
  ignore: (n, t) => `${n} de ${t} siguieron con su día`,
}

export function summarize(reactions: Record<string, Reaction>, a: Announcement) {
  const s = computeStats(reactions)
  const total = s.listeners.length
  const top = ACTIONS.reduce((best, x) => (s.counts[x] > s.counts[best] ? x : best), ACTIONS[0])
  const place = a.place && a.place !== 'home' ? PLACE_LABEL[a.place] : 'la plaza'
  const insights: string[] = []

  const doubters = s.decided.filter((r) => !r.decision!.believes)
  if (doubters.length === 0) insights.push('Nadie dudó del anuncio.')
  else if (doubters.length === s.decided.length) insights.push('Nadie se lo creyó.')
  else {
    const names = doubters.slice(0, 4).map((r) => firstName(r.id))
    const rest = doubters.length - names.length
    const who = rest > 0 ? `${names.join(', ')} y ${rest} más` : list(names)
    insights.push(`${s.believers} de ${s.decided.length} creyeron el anuncio. ${doubters.length === 1 ? 'Solo dudó' : 'Dudaron'} ${who}.`)
  }

  const told = s.listeners.flatMap((r) => r.told.map((to) => [r.id, to] as const))
  if (told.length) insights.push(`Hubo ${told.length} ${told.length === 1 ? 'aviso' : 'avisos'} de boca en boca, empezando por ${firstName(told[0][0])} → ${firstName(told[0][1])}.`)
  const revised = s.listeners.filter((r) => r.revisedBy)
  if (revised.length) insights.push(`${list(revised.map((r) => `${firstName(r.id)} (por ${firstName(r.revisedBy!)})`))} ${revised.length === 1 ? 'cambió' : 'cambiaron'} de opinión tras hablar con alguien.`)

  if (s.decided.length > 1) {
    const sorted = [...s.decided].sort((x, y) => (x.latencyMs ?? 0) - (y.latencyMs ?? 0))
    const fast = sorted[0]
    const slow = sorted[sorted.length - 1]
    insights.push(`${firstName(fast.id)} decidió en ${seconds(fast.latencyMs ?? 0)}; ${firstName(slow.id)} fue quien más lo pensó (${seconds(slow.latencyMs ?? 0)}).`)
  }

  const ageOf = (r: Reaction) => RESIDENTS.find((p) => p.id === r.id)!.age
  const older = s.decided.filter((r) => ageOf(r) >= 60)
  const younger = s.decided.filter((r) => ageOf(r) < 35)
  if (older.length >= 2 && younger.length >= 2) {
    const rate = (g: Reaction[]) => g.filter((r) => r.decision!.believes).length / g.length
    const diff = rate(younger) - rate(older)
    if (diff >= 0.3) insights.push('Los jóvenes se lo creyeron mucho más que los mayores de 60.')
    else if (diff <= -0.3) insights.push('Los mayores de 60 confiaron más que los jóvenes.')
  }

  const errors = s.listeners.filter((r) => r.phase === 'error').length
  if (errors) insights.push(`${errors} ${errors === 1 ? 'residente no pudo' : 'residentes no pudieron'} decidir.`)

  return { headline: s.counts[top] ? HEADLINE[top](s.counts[top], total, place) : 'Nadie ha decidido todavía', top, insights, stats: s }
}
