import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { errorSummary, type ContenderReport } from '../src/core/bench/analysis'
import { RULE_LABEL } from '../src/core/bench/coherence'
import { compareSides } from '../src/core/bench/compare'
import { executeRun, RUN_FORMAT, trialsPerContender, type BenchRun, type RunSetup } from '../src/core/bench/run'
import { FAIL_FAST_AFTER, type BenchProgress } from '../src/core/bench/runner'
import { MAX_CONCURRENCY } from '../src/providers'
import { DEFAULT_SETTINGS, PRESETS, type Connection } from '../src/providers/llm/config'
import { createLlmProvider } from '../src/providers/llm/provider'
import { createRulesProvider, mockDecision } from '../src/providers/mock'
import { activeWorld } from '../src/worlds'
import { seconds, tokens, usd } from '../src/core/format'
import { cacheText } from '../src/core/reactions/metrics'
import { bold, connectionForSpec, PRICE_RE, dim, ENV, fail, nodeStream, red, tty } from './cli'
import { runJudge, summarizeJudgments } from '../src/core/bench/judge'
import { createModelJudge } from '../src/providers/judge'
import { nameOf } from '../src/core/lang'
import { GOLDEN_SIZE } from '../src/core/bench/golden'
import { runFileName } from '../src/core/bench/bundle'
import { ACTION_META } from '../src/theme/actions'

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
      --price <entrada/salida>           USD por millón de tokens para los modelos sin precio propio, ej. 3/15.
                                         Precio de un solo modelo: -m proveedor:modelo=3/15
                                         Sin la caché de Anthropic, para medir lo que ahorra: -m anthropic:modelo~sin-cache
      --rapida                           Solo los casos de oro (${GOLDEN_SIZE} decisiones con una respuesta clara), una vez cada uno.
      --juez <proveedor:modelo>          Al terminar, un modelo juzga de 1 a 5 si las decisiones suenan a cada vecino.
      --muestras <n>                     Decisiones que juzga por contendiente (por defecto 12).
  -o, --out <archivo.json>               Dónde guardar la corrida (por defecto AI_TOWN_RUNS_DIR o bench-results/).
      --dry-run                          Muestra el plan sin hacer peticiones.
      --compare <antes.json> <después.json>
                                         Compara dos corridas guardadas en vez de correr una.
  -h, --help

Hosts y keys salen de .env / .env.local:
  ANTHROPIC_API_KEY · OPENAI_API_KEY · SHELLM_HOST, SHELLM_KEY · CUSTOM_LLM_HOST, CUSTOM_LLM_KEY, CUSTOM_LLM_PROTOCOL

El JSON resultante se puede importar en el historial del Banco de pruebas del navegador. Con AI_TOWN_RUNS_DIR apuntando a la
carpeta compartida que enlazaste en el navegador, cada corrida aparece allí sola.`

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
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
    juez: { type: 'string' },
    rapida: { type: 'boolean', default: false },
    muestras: { type: 'string', default: '12' },
    'dry-run': { type: 'boolean', default: false },
    compare: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const content = activeWorld.content
if (args.help) {
  console.log(HELP.replace('%SCENARIOS%', content.examples.map((e) => e.id).join(', ')))
  process.exit(0)
}
if (args.compare) {
  compareFiles(positionals)
  process.exit(0)
}

const int = (name: string, raw: string, min: number, max: number) => {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) fail(`--${name} debe ser un entero entre ${min} y ${max}.`)
  return n
}
const quick = args.rapida
const repetitions = quick ? 1 : int('reps', args.reps, 1, 50)
const seed = int('seed', args.seed, -(2 ** 31), 2 ** 31)
const timeoutMs = int('timeout', args.timeout, 5, 3600) * 1000
const concurrency = args.concurrency ? int('concurrency', args.concurrency, 1, MAX_CONCURRENCY) : null
const price = args.price?.match(PRICE_RE)
if (args.price && !price) fail('--price va como entrada/salida, ej. 3/15.')

const ids = args.scenarios?.split(',').map((s) => s.trim()) ?? content.examples.map((e) => e.id)
const unknown = ids.filter((id) => !content.examples.some((e) => e.id === id))
if (unknown.length) fail(`Pregón desconocido: ${unknown.join(', ')}. Hay: ${content.examples.map((e) => e.id).join(', ')}.`)
const examples = quick ? content.examples : content.examples.filter((e) => ids.includes(e.id))

const NO_CACHE = '~sin-cache'
const connectionFor = (spec: string) => connectionForSpec(spec, { concurrency, price })

const contenders: RunSetup['contenders'] = []
if (!args['skip-rules']) {
  contenders.push({
    contender: { id: 'rules', label: 'Reglas locales', provider: createRulesProvider(content.vocabulary), concurrency: 16, timeoutMs: 5000 },
    info: { id: 'rules', label: 'Reglas locales', kind: 'rules', model: '', host: '', concurrency: 16 },
  })
}
for (const spec of args.model) {
  const noCache = spec.endsWith(NO_CACHE)
  const c = { ...connectionFor(noCache ? spec.slice(0, -NO_CACHE.length) : spec), promptCache: !noCache }
  const id = `${c.kind}:${c.model}${c.host !== DEFAULT_SETTINGS.connections[c.kind].host ? `@${c.host}` : ''}${noCache ? ':sin-cache' : ''}`
  if (contenders.some((x) => x.contender.id === id)) fail(`«${spec}» está repetido.`)
  const label = `${PRESETS[c.kind].label} · ${c.model}${noCache ? ' · sin caché' : ''}`
  contenders.push({
    contender: { id, label, provider: createLlmProvider(c, nodeStream), concurrency: c.concurrency, timeoutMs },
    info: { id, label, kind: c.kind, model: c.model, host: c.host, concurrency: c.concurrency },
  })
}
if (!contenders.length) fail('No hay contendientes. Añade alguno con -m proveedor:modelo.')

const perContender = quick ? GOLDEN_SIZE : trialsPerContender(content, examples, repetitions)
const llms = contenders.filter((c) => c.info.kind !== 'rules')
console.log(bold(`Banco de pruebas · ${content.name}`))
console.log(dim(quick ? `Prueba rápida: ${GOLDEN_SIZE} casos de oro · semilla ${seed}` : `${examples.length} pregones × ${repetitions} repeticiones · semilla ${seed} · ${perContender} peticiones por contendiente`))
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
  { content, examples, seed, repetitions, contenders, reference: (ctx) => mockDecision(ctx, content.vocabulary), quick },
  { signal: controller.signal, onTrial: (_t, p) => drawProgress(p) },
)
process.stdout.write('\n\n')
printReport(run)
if (args.juez && run.trials.length && !run.cancelled) await judge(run)

// A synced folder shared with the browser's history, if set; bench-results/ otherwise.
const out = args.out ?? join(process.env.AI_TOWN_RUNS_DIR || 'bench-results', runFileName(run))
if (run.trials.length) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(run, null, 2))
  console.log(dim(`\nGuardado en ${out}${run.cancelled ? ' (parcial)' : ''}`))
}
const dead = run.report.contenders.filter((r) => r.trials && r.errors === r.trials)
if (dead.length) console.error(red(`\n✗ Todas las peticiones fallaron en: ${dead.map((r) => r.contender).join(', ')}.`))
process.exit(run.cancelled ? 130 : dead.length ? 1 : 0)

/** A second model reads a sample of decisions and says how in character they were; the verdict is saved inside the run. */
async function judge(run: BenchRun) {
  const connection = connectionForSpec(args.juez!, { price })
  const perContender = int('muestras', args.muestras!, 1, 200)
  process.stdout.write(dim(`\nEl juez (${connection.model}) lee ${perContender} decisiones por contendiente…`))
  const verdict = await runJudge({
    run,
    content,
    judge: `${PRESETS[connection.kind].label} · ${connection.model}`,
    perContender,
    ask: createModelJudge(connection, nodeStream),
    concurrency: 3,
    onProgress: (done, total) => tty && process.stdout.write(`\r\x1b[2K${dim(`El juez va en ${done}/${total}`)}`),
  })
  run.judge = verdict
  console.log(bold('\n\nPersonaje según el juez'))
  for (const s of summarizeJudgments(verdict, run.contenders.filter((c) => c.kind !== 'rules').map((c) => c.id))) {
    const label = run.contenders.find((c) => c.id === s.contender)?.label ?? s.contender
    console.log(`  ${label.padEnd(30)} ${s.mean === null ? '—' : `${s.mean.toFixed(1)} / 5`}${s.failed ? red(`  ${s.failed} sin respuesta`) : ''}`)
    for (const w of s.worst.slice(0, 2)) console.log(dim(`    ${w.score}/5 ${nameOf(content, w.resident)}: ${w.reason}`))
  }
  console.log(dim(`  Costo del juez: ${usd(verdict.costUsd, verdict.costEstimated)}`))
}

function printReport(run: BenchRun) {
  const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)
  const s = seconds
  const k = tokens
  const label = (id: string) => run.contenders.find((c) => c.id === id)?.label ?? id
  const row = (r: ContenderReport) => {
    const m = r.metrics
    const rules = r.contender === 'rules'
    const secs = (run.durations[r.contender] ?? 0) / 1000
    const decided = r.trials - r.errors
    return [
      label(r.contender),
      r.format.checked ? pct(r.format.ok / r.format.checked) : '—',
      pct(r.consistency),
      pct(r.truth ?? null),
      r.golden ? `${pct(r.golden.rate)} (${r.golden.passed}/${r.golden.total})` : '—',
      pct(r.persona ?? null),
      rules ? '—' : pct(r.referenceAgreement),
      r.errors ? `${r.errors}/${r.trials}` : '0',
      m.ttft && !rules ? s(m.ttft.p50) : '—',
      m.total && !rules ? `${s(m.total.p50)} / ${s(m.total.p95)}` : '—',
      !rules && secs && r.errors < r.trials ? (r.trials / secs).toFixed(1) : '—',
      m.tokensPerSecond ? m.tokensPerSecond.toFixed(0) : '—',
      m.inputTokens ? `${k(m.inputTokens)} → ${k(m.outputTokens)}` : '—',
      cacheText(m),
      rules ? '—' : usd(m.costUsd, m.costEstimated),
      rules || m.costUsd === null || !decided ? '—' : usd((m.costUsd / decided) * 1000, m.costEstimated),
    ]
  }
  const head = ['Contendiente', 'Formato', 'Consist.', 'Acierto', 'Oro', 'Personaje', 'Reglas', 'Errores', '1.ª palabra', 'p50 / p95', 'Pet/s', 'Tok/s', 'Tokens', 'Caché', 'Costo', '$/1k dec.']
  const rows = run.report.contenders.map(row)
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
  const fmt = (cells: string[]) => cells.map((c, i) => (i ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join('  ')
  console.log(bold(fmt(head)))
  for (const r of rows) console.log(fmt(r))

  const errors = errorSummary(run.trials)
  if (errors.size) {
    console.log(bold('\nErrores'))
    for (const [id, list] of errors) {
      console.log(`  ${label(id)}${run.stopped?.includes(id) ? red(` · se detuvo: sus primeras ${FAIL_FAST_AFTER} peticiones fallaron`) : ''}`)
      for (const [message, n] of list) console.log(`    ${red(`${n}×`)} ${message}`)
    }
  }

  const offCharacter = run.report.contenders.filter((r) => r.personaBroken && Object.keys(r.personaBroken).length)
  if (offCharacter.length) {
    const name = (id: string) => nameOf(content, id)
    console.log(bold('\nFuera de personaje'))
    for (const r of offCharacter) {
      console.log(`  ${label(r.contender)}`)
      for (const [rule, e] of Object.entries(r.personaBroken!).sort((a, b) => b[1].count - a[1].count))
        console.log(`    ${red(`${e.count}×`)} ${RULE_LABEL[rule] ?? rule}: ${e.residents.map(name).join(', ')}`)
    }
  }

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

function readRun(file: string): BenchRun {
  let run: BenchRun
  try {
    run = JSON.parse(readFileSync(file, 'utf8')) as BenchRun
  } catch {
    fail(`No se pudo leer ${file}.`)
  }
  if (run.format !== RUN_FORMAT) fail(`${file} no es una corrida de AI Town.`)
  return run
}

/** Every contender present in both runs; if they share none but each has one model, those two. */
function compareFiles(files: string[]) {
  if (files.length !== 2) fail('--compare necesita dos archivos: antes y después.')
  const [before, after] = files.map(readRun)
  const shared = before.contenders.map((c) => c.id).filter((id) => after.contenders.some((c) => c.id === id))
  const models = (r: BenchRun) => r.contenders.filter((c) => c.kind !== 'rules').map((c) => c.id)
  const pairs: [string, string][] = shared.length
    ? shared.map((id) => [id, id])
    : models(before).length === 1 && models(after).length === 1
      ? [[models(before)[0], models(after)[0]]]
      : fail('Las corridas no tienen contendientes en común; no sé qué comparar.')
  const name = (id: string) => nameOf(content, id)
  const fmt = (v: number | null, unit: string) =>
    v === null ? '—' : unit === 'pct' ? `${Math.round(v * 100)}%` : unit === 'ms' ? seconds(v) : unit === 'usd' ? usd(v) : v.toFixed(1)
  for (const [a, b] of pairs) {
    const cmp = compareSides({ run: before, contender: a }, { run: after, contender: b })
    const label = (run: BenchRun, id: string) => run.contenders.find((c) => c.id === id)?.label ?? id
    console.log(bold(`\n${label(before, a)}  →  ${label(after, b)}`))
    for (const c of cmp.caveats) console.log(dim(`  ! ${c}`))
    for (const m of cmp.metrics.filter((m) => m.base !== null || m.next !== null)) {
      const mark = m.verdict === 'better' ? '▲ mejor' : m.verdict === 'worse' ? red('▼ peor') : dim(m.verdict === 'same' ? 'igual' : '')
      console.log(`  ${m.label.padEnd(20)} ${fmt(m.base, m.unit).padStart(9)} → ${fmt(m.next, m.unit).padStart(9)}  ${mark}`)
    }
    console.log(`\n  ${cmp.changes.length} de ${cmp.compared} decisiones cambiaron`)
    for (const c of cmp.changes) console.log(`    ${c.scenario.padEnd(8)} ${name(c.resident).padEnd(19)} ${ACTION_META[c.base].short} → ${ACTION_META[c.next].short}`)
  }
}
