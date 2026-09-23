import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { describeError, listModels, normalizeHost, streamCompletion, type CompletionRequest, type Target } from '../src/providers/llm/transport'

interface JobRequest extends CompletionRequest {
  channel: string
  job: string
  connection: Target
  /** Who the request is for, only used in the terminal log. */
  tag?: string
}

interface Channel {
  send: (data: object) => void
  jobs: Map<string, AbortController>
}

const ENV_KEYS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  shellm: 'SHELLM_KEY',
  custom: 'CUSTOM_LLM_KEY',
}
const KEEPALIVE_MS = 15000

/** Browsers cap open connections per host (~6), so each tab holds one event stream and decisions are short POSTs answered on it. */
export function llmProxy(env: Record<string, string>): Plugin {
  const channels = new Map<string, Channel>()
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const route = req.url?.split('?')[0]
    if (req.method === 'GET' && route === '/health') return json(res, 200, { ok: true })
    if (req.method === 'GET' && route === '/channel') return openChannel(res, channels)
    if (req.method !== 'POST') return next()
    if (route === '/job') return void startJob(req, res, channels, env)
    if (route === '/cancel') return void cancelJob(req, res, channels)
    if (route === '/models') return void models(req, res, env)
    next()
  }
  return {
    name: 'ai-town-llm-proxy',
    configureServer: (server) => void server.middlewares.use('/api/llm', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/api/llm', handler),
  }
}

function log(mark: string, message: string) {
  const time = new Date().toLocaleTimeString('es', { hour12: false })
  console.log(`\x1b[2m${time}\x1b[0m \x1b[35m[llm]\x1b[0m ${mark} ${message}`)
}

function json(res: ServerResponse, status: number, body: object) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

function withKey(t: Target, env: Record<string, string>): Target {
  return { ...t, host: normalizeHost(t.host), apiKey: t.apiKey || env[ENV_KEYS[t.kind]] || '' }
}

function openChannel(res: ServerResponse, channels: Map<string, Channel>) {
  const id = randomUUID()
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
  const channel: Channel = { send: (data) => res.write(`data: ${JSON.stringify(data)}\n\n`), jobs: new Map() }
  channels.set(id, channel)
  channel.send({ type: 'hello', channel: id })
  const keepalive = setInterval(() => res.write(': ping\n\n'), KEEPALIVE_MS)
  res.on('close', () => {
    clearInterval(keepalive)
    for (const controller of channel.jobs.values()) controller.abort()
    channels.delete(id)
  })
}

async function startJob(req: IncomingMessage, res: ServerResponse, channels: Map<string, Channel>, env: Record<string, string>) {
  const body = await readJson<JobRequest>(req)
  const channel = channels.get(body.channel)
  if (!channel) return json(res, 410, { error: 'El canal ya no existe; recarga la página.' })
  json(res, 202, { ok: true })

  const controller = new AbortController()
  channel.jobs.set(body.job, controller)
  const target = withKey(body.connection, env)
  const who = `${target.kind} · ${target.model || '¿modelo?'} · ${body.tag ?? 'prueba'}`
  const t0 = Date.now()
  let chars = 0
  log('→', who)
  try {
    const usage = await streamCompletion(
      target,
      body,
      (delta) => {
        chars += delta.length
        channel.send({ type: 'delta', job: body.job, delta })
      },
      controller.signal,
    )
    channel.send({ type: 'done', job: body.job, usage })
    const tokens = usage.inputTokens !== undefined ? ` · ${usage.inputTokens}→${usage.outputTokens} tokens` : ''
    log('✓', `${who} · ${Date.now() - t0} ms · ${chars} caracteres${tokens}`)
  } catch (err) {
    if (controller.signal.aborted) log('·', `${who} · cancelada`)
    else {
      log('✗', `${who} · ${Date.now() - t0} ms · ${describeError(err)}`)
      channel.send({ type: 'error', job: body.job, error: describeError(err) })
    }
  } finally {
    channel.jobs.delete(body.job)
  }
}

async function cancelJob(req: IncomingMessage, res: ServerResponse, channels: Map<string, Channel>) {
  const { channel, job } = await readJson<{ channel: string; job: string }>(req)
  channels.get(channel)?.jobs.get(job)?.abort()
  json(res, 200, { ok: true })
}

async function models(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  try {
    const { connection } = await readJson<{ connection: Target }>(req)
    const target = withKey(connection, env)
    json(res, 200, { models: await listModels(target), usingEnvKey: !connection.apiKey && !!target.apiKey })
  } catch (err) {
    json(res, 502, { error: describeError(err) })
  }
}
