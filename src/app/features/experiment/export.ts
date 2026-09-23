import type { Reaction } from '../../../core/reactions/engine'
import { allCalls, runMetrics } from '../../../core/reactions/metrics'
import type { Announcement } from '../../../core/reactions/announcement'
import type { LlmSettings } from '../../../providers/llm/config'
import { town } from '../../town'

const nameOf = (id: string) => town.content.residents.find((r) => r.id === id)?.name ?? id

/** What ran, without the key: enough to tell runs apart and repeat them. */
function describeSetup(llm: LlmSettings) {
  if (llm.active === 'mock') return { provider: 'mock' }
  const { kind, protocol, host, model, concurrency, priceIn, priceOut } = llm.connections[llm.active]
  return { provider: kind, protocol, host, model, concurrency, priceIn, priceOut }
}

export function runReport(announcement: Announcement, reactions: Record<string, Reaction>, llm: LlmSettings) {
  const listeners = Object.values(reactions).filter((r) => !r.isSpeaker)
  const calls = allCalls(listeners)
  return {
    format: 'ai-town-run/1',
    exportedAt: new Date().toISOString(),
    world: town.content.id,
    setup: describeSetup(llm),
    announcement: { text: announcement.text, speaker: announcement.speaker, place: announcement.place, minutes: announcement.minutes },
    metrics: runMetrics(calls),
    residents: listeners.map((r) => ({
      id: r.id,
      name: nameOf(r.id),
      phase: r.phase,
      heardVia: r.heardVia,
      decision: r.decision,
      previous: r.previous,
      revisedBy: r.revisedBy,
      error: r.error,
      calls: r.calls,
    })),
  }
}

const CSV_COLUMNS = ['resident', 'name', 'provider', 'revision', 'at_ms', 'queue_ms', 'ttft_ms', 'total_ms', 'input_tokens', 'output_tokens', 'cost_usd', 'cost_source', 'action', 'believes', 'error']

const cell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per provider call, the shape spreadsheets and notebooks want. */
export function callsCsv(reactions: Record<string, Reaction>) {
  const rows = allCalls(Object.values(reactions).filter((r) => !r.isSpeaker)).map((c) => [
    c.id,
    nameOf(c.id),
    c.provider,
    c.revision,
    c.at,
    c.queueMs,
    c.ttftMs,
    c.totalMs,
    c.usage?.inputTokens,
    c.usage?.outputTokens,
    c.usage?.costUsd,
    c.usage?.costSource,
    c.action,
    c.believes,
    c.error,
  ])
  return toCsv(CSV_COLUMNS, rows)
}

export const toCsv = (columns: string[], rows: unknown[][]) => [columns, ...rows].map((row) => row.map(cell).join(',')).join('\n')

export function download(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
