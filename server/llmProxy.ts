import Anthropic from '@anthropic-ai/sdk'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

export type Protocol = 'anthropic' | 'openai'

export interface Connection {
  kind: string
  protocol: Protocol
  host: string
  apiKey: string
  model: string
}

interface ChatRequest {
  connection: Connection
  system: string
  prompt: string
  maxTokens?: number
}

const ENV_KEYS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  shellm: 'SHELLM_KEY',
  custom: 'CUSTOM_LLM_KEY',
}

const FALLBACK_MODELS = ['claude-opus-5', 'claude-fable-5-1']
const HEADERS_TIMEOUT_MS = 30000

class HostTimeout extends Error {
  constructor() {
    super('El host no respondió en 30 s. ¿Es la dirección correcta y el servicio está encendido?')
  }
}

/** fetch that gives up if the server accepts the connection but never answers. */
async function fetchWithTimeout(url: string, init: RequestInit & { signal?: AbortSignal }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new HostTimeout()), HEADERS_TIMEOUT_MS)
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal
  try {
    return await fetch(url, { ...init, signal })
  } catch (err) {
    throw controller.signal.aborted ? controller.signal.reason : err
  } finally {
    clearTimeout(timer)
  }
}

/** Dev-server middleware so API keys and local hosts like SheLLM never need CORS or browser-side credentials. */
export function llmProxy(env: Record<string, string>): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (req.method !== 'POST') return next()
    const route = req.url?.split('?')[0]
    if (route === '/chat') return void chat(req, res, env)
    if (route === '/models') return void models(req, res, env)
    next()
  }
  return {
    name: 'ai-town-llm-proxy',
    configureServer: (server) => void server.middlewares.use('/api/llm', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/api/llm', handler),
  }
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

function withKey(c: Connection, env: Record<string, string>): Connection {
  return { ...c, host: c.host.replace(/\/+$/, '').replace(/\/v1$/, ''), apiKey: c.apiKey || env[ENV_KEYS[c.kind]] || '' }
}

function describeError(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return 'La API key no es válida.'
  if (err instanceof Anthropic.RateLimitError) return 'Límite de peticiones alcanzado; espera un momento.'
  if (err instanceof Anthropic.NotFoundError) return 'El modelo o la ruta no existen en ese host.'
  if (err instanceof Anthropic.APIError) return `Error ${err.status ?? ''} del proveedor: ${err.message}`.trim()
  if (err instanceof HostTimeout) return err.message
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new HostTimeout().message
  if (err instanceof Error) return err.name === 'AbortError' ? 'Petición cancelada.' : humanizeNetwork(err)
  return 'Error desconocido.'
}

function humanizeNetwork(err: Error) {
  const cause = (err as Error & { cause?: { code?: string } }).cause?.code
  if (cause === 'ECONNREFUSED') return 'No hay nada escuchando en ese host. ¿Está encendido el servicio?'
  if (cause === 'ENOTFOUND') return 'No se encontró el host.'
  return err.message
}

async function chat(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`)
  try {
    const body = await readJson<ChatRequest>(req)
    const c = withKey(body.connection, env)
    if (!c.model) throw new Error('Falta elegir un modelo.')
    const onText = (delta: string) => send({ delta })
    if (c.protocol === 'anthropic') await streamAnthropic(c, body, onText, controller.signal)
    else await streamOpenAI(c, body, onText, controller.signal)
    send({ done: true })
  } catch (err) {
    if (!controller.signal.aborted) send({ error: describeError(err) })
  }
  res.end()
}

async function streamAnthropic(c: Connection, body: ChatRequest, onText: (t: string) => void, signal: AbortSignal) {
  const client = new Anthropic({ apiKey: c.apiKey, baseURL: c.host, maxRetries: 1, timeout: 120000 })
  const official = /api\.anthropic\.com/.test(c.host)
  const withFallbacks = official && FALLBACK_MODELS.includes(c.model)
  const stream = client.beta.messages.stream(
    {
      model: c.model,
      max_tokens: body.maxTokens ?? 16000,
      system: body.system,
      messages: [{ role: 'user', content: body.prompt }],
      ...(withFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    },
    { signal },
  )
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onText(event.delta.text)
  }
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') throw new Error('El modelo se negó a responder esta petición.')
  if (final.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por el límite de tokens.')
}

async function streamOpenAI(c: Connection, body: ChatRequest, onText: (t: string) => void, signal: AbortSignal) {
  const response = await fetchWithTimeout(`${c.host}/v1/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', ...(c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {}) },
    body: JSON.stringify({
      model: c.model,
      stream: true,
      messages: [
        { role: 'system', content: body.system },
        { role: 'user', content: body.prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Error ${response.status} del proveedor: ${(await response.text()).slice(0, 300)}`)
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    return onText(json.choices?.[0]?.message?.content ?? '')
  }
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.replace(/^data:\s?/, '').trim()
      if (!line.startsWith('data:') || !data || data === '[DONE]') continue
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; error?: { message?: string } }
      if (chunk.error) throw new Error(chunk.error.message ?? 'Error del proveedor.')
      const text = chunk.choices?.[0]?.delta?.content
      if (text) onText(text)
    }
  }
}

async function models(req: IncomingMessage, res: ServerResponse, env: Record<string, string>) {
  res.setHeader('content-type', 'application/json')
  try {
    const { connection } = await readJson<{ connection: Connection }>(req)
    const c = withKey(connection, env)
    let ids: string[]
    if (c.protocol === 'anthropic') {
      const client = new Anthropic({ apiKey: c.apiKey, baseURL: c.host, maxRetries: 0, timeout: HEADERS_TIMEOUT_MS })
      ids = []
      for await (const m of client.models.list({ limit: 100 })) ids.push(m.id)
    } else {
      const response = await fetchWithTimeout(`${c.host}/v1/models`, { headers: c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {} })
      if (!response.ok) throw new Error(`Error ${response.status} al listar modelos.`)
      const json = (await response.json()) as { data?: { id: string }[] }
      ids = (json.data ?? []).map((m) => m.id)
    }
    res.end(JSON.stringify({ models: ids, usingEnvKey: !connection.apiKey && !!c.apiKey }))
  } catch (err) {
    res.statusCode = 502
    res.end(JSON.stringify({ error: describeError(err) }))
  }
}
