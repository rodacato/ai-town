import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import type { ContenderReport } from '../src/core/bench/analysis'
import { executeRun, trialsPerContender, type BenchRun, type RunSetup } from '../src/core/bench/run'
import type { BenchProgress } from '../src/core/bench/runner'
import { MAX_CONCURRENCY } from '../src/providers'
import type { ChatStream } from '../src/providers/llm/client'
import { DEFAULT_SETTINGS, PRESETS, type Connection } from '../src/providers/llm/config'
import { createLlmProvider } from '../src/providers/llm/provider'
import { completionEvents } from '../src/providers/llm/transport'
import { createRulesProvider, mockDecision } from '../src/providers/mock'
import { activeWorld } from '../src/worlds'

const HELP = `Banco de pruebas de AI Town desde la terminal.

Uso: npm run bench -- [opciones]

  -m, --model <proveedor:modelo[@host]>  Contendiente; repítelo para comparar.
                                         Proveedores: anthropic, openai, shellm, custom.
                                         Ej: -m shellm:claude -m shellm:codex -m custom:llama3.2:3b
      --skip-rules                       No incluir las reglas locales como referencia.
  -s, --scenarios <ids>                  Pregones separados por coma (por defecto, todos): %SCENARIOS%
  -r, --reps <n>                         Repeticiones por residente (por defecto 3).
      --seed <n>                         Semilla del pueblo (por defecto 7).
  -c, --concurrency <n>                  Peticiones a la vez por contendiente (1–${MAX_CONCURRENCY}).
      --timeout <s>                      Tiempo máximo por decisión (por defecto 120).
      --price <entrada/salida>           USD por millón de tokens para estimar costo, ej. 3/15.
  -o, --out <archivo.json>               Dónde guardar la corrida (por defecto bench-results/).
      --dry-run                          Muestra el plan sin hacer peticiones.
  -h, --help

Hosts y keys salen de .env / .env.local:
  ANTHROPIC_API_KEY · OPENAI_API_KEY · SHELLM_HOST, SHELLM_KEY · CUSTOM_LLM_HOST, CUSTOM_LLM_KEY, CUSTOM_LLM_PROTOCOL

El JSON resultante se puede importar en el historial del Banco de pruebas del navegador.`

const ENV: Record<Connection['kind'], { host?: string; key: string; protocol?: string }> = {
  anthropic: { host: 'ANTHROPIC_HOST', key: 'ANTHROPIC_API_KEY' },
  openai: { host: 'OPENAI_HOST', key: 'OPENAI_API_KEY' },
  shellm: { host: 'SHELLM_HOST', key: 'SHELLM_KEY', protocol: 'SHELLM_PROTOCOL' },
  custom: { host: 'CUSTOM_LLM_HOST', key: 'CUSTOM_LLM_KEY', protocol: 'CUSTOM_LLM_PROTOCOL' },
}

const tty = process.stdout.isTTY
const style = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s)
const dim = style(2)
const bold = style(1)
const red = style(31)

function fail(message: string): never {
  console.error(red(`✗ ${message}`))
  process.exit(2)
}

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file)
  } catch {
    // A missing env file just means keys come from the shell.
  }
}

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', short: 'm', multiple: true, default: [] },
    'skip-rules': { type: 'boolean', default: false },
    scenarios: { type: 'string', short: 's' },
    reps: { type: 'string', short: 'r', default: '3' },
    seed: { type: 'string', default: '7' },
    concurrency: { type: 'string', short: 'c' },
    timeout: { type: 'string', default: '120' },
    price: { type: 'string' },
    out: { type: 'string', short: 'o' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const content = activeWorld.content
if (args.help) {
  console.log(HELP.replace('%SCENARIOS%', content.examples.map((e) => e.id).join(', ')))
  process.exit(0)
}

const int = (name: string, raw: string, min: number, max: number) => {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) fail(`--${name} debe ser un entero entre ${min} y ${max}.`)
  return n
}
const repetitions = int('reps', args.reps, 1, 50)
const seed = int('seed', args.seed, -(2 ** 31), 2 ** 31)
const timeoutMs = int('timeout', args.timeout, 5, 3600) * 1000
const concurrency = args.concurrency ? int('concurrency', args.concurrency, 1, MAX_CONCURRENCY) : null
const price = args.price?.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
if (args.price && !price) fail('--price va como entrada/salida, ej. 3/15.')

const ids = args.scenarios?.split(',').map((s) => s.trim()) ?? content.examples.map((e) => e.id)
const unknown = ids.filter((id) => !content.examples.some((e) => e.id === id))
if (unknown.length) fail(`Pregón desconocido: ${unknown.join(', ')}. Hay: ${content.examples.map((e) => e.id).join(', ')}.`)
const examples = content.examples.filter((e) => ids.includes(e.id))

/** The CLI talks to providers straight from Node: no proxy, no browser connection cap. */
const nodeStream: ChatStream = (connection, system, prompt, signal, opts = {}) => completionEvents(connection, { system, prompt, maxTokens: opts.maxTokens, timeoutMs: opts.timeoutMs }, signal)

function connectionFor(spec: string): Connection {
  const colon = spec.indexOf(':')
  const kind = spec.slice(0, colon) as Connection['kind']
  if (colon < 0 || !(kind in ENV)) fail(`Contendiente «${spec}»: usa proveedor:modelo, con proveedor ${Object.keys(ENV).join(', ')}.`)
  let model = spec.slice(colon + 1)
  let host: string | undefined
  const at = model.lastIndexOf('@')
  if (at >= 0) [model, host] = [model.slice(0, at), model.slice(at + 1)]
  if (!model) fail(`Contendiente «${spec}»: falta el modelo.`)
  const env = ENV[kind]
  const base = DEFAULT_SETTINGS.connections[kind]
  const protocol = (env.protocol && process.env[env.protocol]) || base.protocol
  if (protocol !== 'openai' && protocol !== 'anthropic') fail(`Protocolo desconocido «${protocol}» para ${kind}.`)
  return {
    ...base,
    protocol,
    model,
    host: host ?? (env.host && process.env[env.host]) ?? base.host,
    apiKey: process.env[env.key] ?? '',
    concurrency: concurrency ?? base.concurrency,
    ...(price ? { priceIn: Number(price[1]), priceOut: Number(price[2]) } : {}),
  }
}

const contenders: RunSetup['contenders'] = []
if (!args['skip-rules']) {
  contenders.push({
    contender: { id: 'rules', label: 'Reglas locales', provider: createRulesProvider(content.vocabulary), concurrency: 16, timeoutMs: 5000 },
    info: { id: 'rules', label: 'Reglas locales', kind: 'rules', model: '', host: '', concurrency: 16 },
  })
}
for (const spec of args.model) {
  const c = connectionFor(spec)
  const id = `${c.kind}:${c.model}${c.host !== DEFAULT_SETTINGS.connections[c.kind].host ? `@${c.host}` : ''}`
  if (contenders.some((x) => x.contender.id === id)) fail(`«${spec}» está repetido.`)
  const label = `${PRESETS[c.kind].label} · ${c.model}`
  contenders.push({
    contender: { id, label, provider: createLlmProvider(c, nodeStream), concurrency: c.concurrency, timeoutMs },
    info: { id, label, kind: c.kind, model: c.model, host: c.host, concurrency: c.concurrency },
  })
}
if (!contenders.length) fail('No hay contendientes. Añade alguno con -m proveedor:modelo.')

const perContender = trialsPerContender(content, examples, repetitions)
const llms = contenders.filter((c) => c.info.kind !== 'rules')
console.log(bold(`Banco de pruebas · ${content.name}`))
console.log(dim(`${examples.length} pregones × ${repetitions} repeticiones · semilla ${seed} · ${perContender} peticiones por contendiente`))
for (const { info } of contenders) {
  const keyless = info.kind !== 'rules' && !process.env[ENV[info.kind as Connection['kind']].key]
  console.log(`  ${info.label}${info.host ? dim(` · ${info.host} · ${info.concurrency} a la vez`) : ''}${keyless ? dim(' · sin key') : ''}`)
}
if (llms.some((c) => c.info.kind === 'anthropic' || c.info.kind === 'openai')) console.log(red('  Usa tu API key: esto cuesta dinero real.'))
if (args['dry-run']) process.exit(0)
console.log()

const controller = new AbortController()
process.on('SIGINT', () => {
  if (controller.signal.aborted) process.exit(130)
  console.log(dim('\nCancelando… (Ctrl+C otra vez para salir ya)'))
  controller.abort()
})

let started = performance.now()
let current = ''
function drawProgress(p: BenchProgress) {
  if (p.contender !== current) {
    if (current) process.stdout.write('\n')
    current = p.contender
    started = performance.now()
  }
  const label = contenders.find((c) => c.contender.id === p.contender)!.info.label
  const width = 24
  const filled = Math.round((p.done / p.total) * width)
  const rate = p.done / Math.max(0.001, (performance.now() - started) / 1000)
  const line = `  ${label.padEnd(28)} [${'█'.repeat(filled)}${dim('░'.repeat(width - filled))}] ${String(p.done).padStart(4)}/${p.total}  ${p.contender === 'rules' ? '' : `${rate.toFixed(1)} pet/s`}${p.errors ? red(`  ${p.errors} errores`) : ''}`
  if (tty) process.stdout.write(`\r\x1b[2K${line}`)
  else if (p.done === p.total || p.done % 25 === 0) console.log(line)
}

const run = await executeRun(
  { content, examples, seed, repetitions, contenders, reference: (ctx) => mockDecision(ctx, content.vocabulary) },
  { signal: controller.signal, onTrial: (_t, p) => drawProgress(p) },
)
process.stdout.write('\n\n')
printReport(run)

const out = args.out ?? `bench-results/${content.id}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
if (run.trials.length) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(run, null, 2))
  console.log(dim(`\nGuardado en ${out}${run.cancelled ? ' (parcial)' : ''}`))
}
const dead = run.report.contenders.filter((r) => r.trials && r.errors === r.trials)
if (dead.length) console.error(red(`\n✗ Todas las peticiones fallaron en: ${dead.map((r) => r.contender).join(', ')}. Primer error: ${run.trials.find((t) => t.contender === dead[0].contender)?.error}`))
process.exit(run.cancelled ? 130 : dead.length ? 1 : 0)

function printReport(run: BenchRun) {
  const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)
  const s = (ms: number) => `${(ms / 1000).toFixed(1)}s`
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))
  const label = (id: string) => run.contenders.find((c) => c.id === id)?.label ?? id
  const row = (r: ContenderReport) => {
    const m = r.metrics
    const rules = r.contender === 'rules'
    const secs = (run.durations[r.contender] ?? 0) / 1000
    return [
      label(r.contender),
      r.format.checked ? pct(r.format.ok / r.format.checked) : '—',
      pct(r.consistency),
      rules ? '—' : pct(r.referenceAgreement),
      r.errors ? `${r.errors}/${r.trials}` : '0',
      m.total && !rules ? `${s(m.total.p50)} / ${s(m.total.p95)}` : '—',
      !rules && secs ? (r.trials / secs).toFixed(1) : '—',
      m.tokensPerSecond ? m.tokensPerSecond.toFixed(0) : '—',
      m.inputTokens ? `${k(m.inputTokens)} → ${k(m.outputTokens)}` : '—',
      m.costUsd === null ? '—' : `${m.costEstimated ? '≈' : ''}$${m.costUsd.toFixed(m.costUsd < 0.01 ? 4 : 2)}`,
    ]
  }
  const head = ['Contendiente', 'Formato', 'Consist.', 'Reglas', 'Errores', 'p50 / p95', 'Pet/s', 'Tok/s', 'Tokens', 'Costo']
  const rows = run.report.contenders.map(row)
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
  const fmt = (cells: string[]) => cells.map((c, i) => (i ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ')
  console.log(bold(fmt(head)))
  for (const r of rows) console.log(fmt(r))

  const pairs = Object.entries(run.report.agreement)
  if (pairs.length) {
    console.log(bold('\nAcuerdo entre contendientes'))
    for (const [pair, v] of pairs) {
      const [a, b] = pair.split('|')
      console.log(`  ${pct(v).padStart(4)}  ${label(a)} ${dim('y')} ${label(b)}`)
    }
  }
  const issues = run.report.contenders.filter((r) => Object.keys(r.format.issues).length)
  if (issues.length) {
    console.log(bold('\nProblemas de formato'))
    for (const r of issues)
      console.log(
        `  ${label(r.contender)}: ${Object.entries(r.format.issues)
          .sort((a, b) => b[1] - a[1])
          .map(([i, n]) => `${i} (${n})`)
          .join(', ')}`,
      )
  }
}
