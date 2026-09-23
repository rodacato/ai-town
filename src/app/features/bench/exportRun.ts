import { toCsv } from '../experiment/export'
import type { BenchRun } from './history'

const COLUMNS = ['contender', 'scenario', 'resident', 'rep', 'action', 'believes', 'confidence', 'speech', 'error', 'format', 'format_issues', 'queue_ms', 'ttft_ms', 'total_ms', 'input_tokens', 'output_tokens', 'cost_usd', 'cost_source']

/** One row per trial, for spreadsheets and notebooks. */
export function trialsCsv(run: BenchRun) {
  const rows = run.trials.map((t) => [
    t.contender,
    t.scenario,
    t.resident,
    t.rep,
    t.action,
    t.believes,
    t.confidence,
    t.speech,
    t.error,
    t.format?.status,
    t.format?.issues.join('; '),
    t.queueMs,
    t.ttftMs,
    t.totalMs,
    t.usage?.inputTokens,
    t.usage?.outputTokens,
    t.usage?.costUsd,
    t.usage?.costSource,
  ])
  return toCsv(COLUMNS, rows)
}
