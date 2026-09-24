import type { ChatStream } from '../src/providers/llm/client'
import { DEFAULT_SETTINGS, type Connection } from '../src/providers/llm/config'
import { completionEvents } from '../src/providers/llm/transport'

/** Shared by the terminal tools: env files, colours, and connections named as proveedor:modelo[@host]. */

export const ENV: Record<Connection['kind'], { host?: string; key: string; protocol?: string }> = {
  anthropic: { host: 'ANTHROPIC_HOST', key: 'ANTHROPIC_API_KEY' },
  openai: { host: 'OPENAI_HOST', key: 'OPENAI_API_KEY' },
  shellm: { host: 'SHELLM_HOST', key: 'SHELLM_KEY', protocol: 'SHELLM_PROTOCOL' },
  custom: { host: 'CUSTOM_LLM_HOST', key: 'CUSTOM_LLM_KEY', protocol: 'CUSTOM_LLM_PROTOCOL' },
}

export const tty = process.stdout.isTTY
const style = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s)
export const dim = style(2)
export const bold = style(1)
export const red = style(31)
export const green = style(32)

export function fail(message: string): never {
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

/** The CLI talks to providers straight from Node: no proxy, no browser connection cap. */
export const nodeStream: ChatStream = (connection, system, prompt, signal, opts = {}) => completionEvents(connection, { system, prompt, prefix: opts.prefix, cache: connection.promptCache !== false, maxTokens: opts.maxTokens, timeoutMs: opts.timeoutMs }, signal)

/** «3/15» → input and output USD per million tokens. */
export const PRICE_RE = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/

/** proveedor:modelo[@host][=entrada/salida]; the price after «=» is this model's own, else `opts.price` applies. */
export function connectionForSpec(raw: string, opts: { concurrency?: number | null; price?: RegExpMatchArray | null } = {}): Connection {
  const eq = raw.lastIndexOf('=')
  const own = eq >= 0 ? raw.slice(eq + 1).match(PRICE_RE) : null
  if (eq >= 0 && !own) fail(`Contendiente «${raw}»: el precio va como =entrada/salida, ej. =3/15.`)
  const spec = eq >= 0 ? raw.slice(0, eq) : raw
  const price = own ?? opts.price
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
  const { concurrency } = opts
  return {
    ...base,
    protocol,
    model,
    host: host ?? (env.host && process.env[env.host]) ?? base.host,
    apiKey: process.env[env.key] ?? '',
    concurrency: concurrency ?? base.concurrency,
    ...(price ? { priceIn: Number(price[1]), priceOut: Number(price[2]), priceModel: model } : {}),
  }
}
