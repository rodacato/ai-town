import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { absentDuelist, ranking, rulesDuelist, runDuel, type Duelist, type ReignSummary } from '../src/core/realm/duel'
import { fateCalendar } from '../src/core/realm/reign'
import { GOALS } from '../src/core/realm/standing'
import { SEASON_DAYS } from '../src/core/realm/terrarium'
import { DIFFICULTIES, DIFFICULTY, type Difficulty } from '../src/core/realm/difficulty'
import { createModelRuler } from '../src/providers/ruler'
import { activeWorld, WORLDS, worldById } from '../src/worlds'
import { usd } from '../src/core/format'
import { bold, connectionForSpec, PRICE_RE, dim, fail, green, nodeStream, red, tty } from './cli'

const HELP = `Duelo de gobernantes: varios gobernantes llevan el mismo año, con la misma semilla y el mismo calendario del destino.

Uso: npm run reign -- [opciones]

  -m, --model <proveedor:modelo[@host]>  Un gobernante con modelo; repítelo para enfrentar varios.
      --skip-rules                       Sin el gobernante de reglas.
      --skip-absent                      Sin el trono vacío (nadie gobierna).
      --seed <n>                         Semilla del calendario del destino (por defecto 7).
      --mundo <id>                       Mundo en el que se juega: %WORLDS% (por defecto el primero).
      --dificultad <normal|dura|cruel>   Golpes del destino, reservas y cosecha (por defecto normal).
      --days <n>                         Días a gobernar (por defecto ${GOALS.yearDays + 1}: un año entero).
      --timeout <s>                      Tiempo máximo por turno (por defecto 120).
      --price <entrada/salida>           USD por millón de tokens para los modelos sin precio propio, ej. 3/15.
                                         Precio de un solo modelo: -m proveedor:modelo=3/15
  -o, --out <archivo.json>               Dónde guardar el duelo (por defecto reign-results/).
      --dry-run                          Muestra el plan y el calendario sin hacer peticiones.
  -h, --help

Cada gobernante con modelo hace una consulta por día. Hosts y keys salen de .env / .env.local, como en npm run bench.`

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', short: 'm', multiple: true, default: [] },
    'skip-rules': { type: 'boolean', default: false },
    mundo: { type: 'string' },
    'skip-absent': { type: 'boolean', default: false },
    seed: { type: 'string', default: '7' },
    days: { type: 'string', default: String(GOALS.yearDays + 1) },
    dificultad: { type: 'string', default: 'normal' },
    timeout: { type: 'string', default: '120' },
    price: { type: 'string' },
    out: { type: 'string', short: 'o' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})
if (args.help) {
  console.log(HELP.replace('%WORLDS%', WORLDS.map((w) => w.content.id).join(', ')))
  process.exit(0)
}

const int = (name: string, raw: string, min: number, max: number) => {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < min || n > max) fail(`--${name} debe ser un entero entre ${min} y ${max}.`)
  return n
}
const seed = int('seed', args.seed, 0, 2 ** 31)
const days = int('days', args.days, 2, 400)
const timeoutMs = int('timeout', args.timeout, 5, 3600) * 1000
const price = args.price?.match(PRICE_RE) ?? null
if (args.price && !price) fail('--price va como entrada/salida, ej. 3/15.')

const difficulty = args.dificultad as Difficulty
if (!DIFFICULTIES.includes(difficulty)) fail(`--dificultad va como ${DIFFICULTIES.join(', ')}.`)
const world = args.mundo ? worldById(args.mundo) : activeWorld
if (!world) fail(`No hay un mundo «${args.mundo}». Hay: ${WORLDS.map((w) => w.content.id).join(', ')}.`)
const content = world!.content
const fate = fateCalendar(content, seed, days, difficulty)

const contenders: Duelist[] = []
if (!args['skip-absent']) contenders.push(absentDuelist)
if (!args['skip-rules']) contenders.push(rulesDuelist)
for (const spec of args.model) {
  const connection = connectionForSpec(spec, { price })
  if (contenders.some((c) => c.id === spec)) fail(`«${spec}» está repetido.`)
  const ruler = createModelRuler(connection, content, nodeStream)
  contenders.push({ id: spec, label: `${connection.model} (${connection.kind})`, decide: (report, signal) => ruler(report, AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])) })
}
if (contenders.length < 2) fail('Hace falta al menos dos gobernantes. Añade alguno con -m proveedor:modelo.')

console.log(bold(`Duelo de gobernantes · ${content.name}`))
console.log(dim(`${days} días · estaciones de ${SEASON_DAYS} días · semilla ${seed} · dificultad ${DIFFICULTY[difficulty].label.toLowerCase()} · ${fate.length} golpes del destino`))
for (const c of contenders) console.log(`  ${c.label}`)
const models = contenders.filter((c) => c.id.includes(':'))
if (models.length) console.log(dim(`  ${models.length * days} consultas como máximo (una por día y gobernante).`))
if (args['dry-run']) {
  console.log(bold('\nCalendario del destino'))
  for (const f of fate) console.log(`  Día ${String(f.day + 1).padStart(2)} · ${String(f.hour).padStart(2, '0')}:00  ${f.text}`)
  process.exit(0)
}

const progress = new Map<string, number>()
const draw = () => {
  if (!tty) return
  const line = contenders.map((c) => `${c.label.slice(0, 22)} ${String(progress.get(c.id) ?? 0).padStart(3)}/${days}`).join(dim('  ·  '))
  process.stdout.write(`\r\x1b[2K${line}`)
}

const duel = await runDuel({
  content,
  seed,
  days,
  difficulty,
  seasonLength: SEASON_DAYS,
  rulers: contenders,
  onDay: (id, day) => {
    progress.set(id, day + 1)
    draw()
  },
})
if (tty) process.stdout.write('\n')

const summaries = duel.rulers.map((r) => r.summary)
printTable(ranking(summaries))
printLetters(summaries)

const out = args.out ?? `reign-results/duelo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ format: 'ai-town-reign/1', world: content.id, ...duel }, null, 2))
console.log(dim(`\nGuardado en ${out}`))

function printTable(list: ReignSummary[]) {
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const cols: [string, (s: ReignSummary) => string][] = [
    ['Final', (s) => (s.won ? green(s.ending) : red(s.ending))],
    ['Días', (s) => `${s.survivedDays}`],
    ['Vecinos', (s) => `${s.population}`],
    ['Muertos', (s) => `${s.deaths}`],
    ['Se fueron', (s) => `${s.departures}`],
    ['Asaltos', (s) => (s.heists ? `${s.heists} (${s.stolen}💰)` : '0')],
    ['Confianza', (s) => pct(s.trust)],
    ['Ánimo', (s) => pct(s.mood)],
    ['Tesoro', (s) => `${s.treasury}`],
    ['Mentiras', (s) => `${s.lies}/${s.proclamations}`],
    ['Formato', (s) => (s.problems || s.errors ? red(`${s.problems} fallos${s.errors ? `, ${s.errors} sin respuesta` : ''}`) : 'ok')],
    ['Costo', (s) => (s.ruler === 'Trono vacío' || s.ruler === 'Reglas' ? '—' : usd(s.costUsd))],
    ['Puntos', (s) => bold(`${s.score}`)],
  ]
  // eslint-disable-next-line no-control-regex
  const visible = (s: string) => s.replace(/\x1b\[\d+m/g, '').length
  const width = Math.max(...cols.map(([name]) => name.length))
  const cells = list.map((s) => cols.map(([, read]) => read(s)))
  const colWidth = list.map((s, i) => Math.max(s.ruler.length, ...cells[i].map(visible)))
  const pad = (v: string, w: number) => v + ' '.repeat(Math.max(0, w - visible(v)))
  console.log()
  console.log(bold(`${''.padEnd(width)}  ${list.map((s, i) => pad(s.ruler, colWidth[i])).join('  ')}`))
  cols.forEach(([name], row) => console.log(`${dim(name.padEnd(width))}  ${list.map((_, i) => pad(cells[i][row], colWidth[i])).join('  ')}`))
  console.log(dim(`\nPuntos: 1 por día, 3 por vecino en casa, hasta 20 por confianza y por ánimo, +25 si acaba el año (+40 si prospera), −5 por asalto.`))
}

function printLetters(list: ReignSummary[]) {
  const writers = list.filter((s) => s.letters.length)
  if (!writers.length) return
  console.log(bold('\nCartas al creador'))
  for (const s of writers) {
    console.log(`  ${s.ruler}`)
    for (const l of s.letters.slice(0, 5)) console.log(`    · ${l}`)
    if (s.letters.length > 5) console.log(dim(`    … y ${s.letters.length - 5} más`))
  }
}

