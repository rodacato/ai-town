import Anthropic from '@anthropic-ai/sdk'

// Shared by the local proxy (Node) and the browser, so both modes stream, count usage and fail the same way.

export type Protocol = 'anthropic' | 'openai'

export interface Target {
  kind: string
  protocol: Protocol
  host: string
  apiKey: string
  model: string
}

/** How hard a reasoning model thinks before answering; SheLLM runs minimal as low. */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'
export const REASONING_EFFORTS: ReasoningEffort[] = ['minimal', 'low', 'medium', 'high']

export interface CompletionRequest {
  system: string
  prompt: string
  /** The part of the prompt shared by many requests (the same announcement for every resident); it goes first so it can be cached. */
  prefix?: string
  /** Mark the system prompt and the prefix for Anthropic's prompt cache. */
  cache?: boolean
  maxTokens?: number
  /** How long to wait for the host to start answering; decisions allow long queues, connection tests fail fast. */
  timeoutMs?: number
  /** Sent as reasoning_effort on OpenAI-compatible hosts; omitted, the host decides. */
  effort?: ReasoningEffort
}

export interface Usage {
  inputTokens?: number
  outputTokens?: number
  /** Cost the host reports itself (SheLLM does); otherwise computed later from a price table. */
  costUsd?: number
  /** Input tokens served from the prompt cache (billed at about a tenth), and written to it (about 1.25×). */
  cacheReadTokens?: number
  cacheWriteTokens?: number
  /** Output tokens the model spent thinking, already counted in outputTokens. */
  reasoningTokens?: number
  /** Timings the host reports (SheLLM does): waiting in its queue, to the first token, and the model's own run. */
  hostQueueMs?: number
  hostTtftMs?: number
  hostModelMs?: number
}

/** SheLLM's namespaced block, the same in both wire formats; unknown values come as null. */
interface ShellmMeta {
  cost_usd?: number | null
  queue_ms?: number | null
  ttft_ms?: number | null
  cli_ms?: number | null
}

function hostMeta(meta: ShellmMeta | undefined): Usage {
  if (!meta) return {}
  const out: Usage = {}
  if (typeof meta.cost_usd === 'number') out.costUsd = meta.cost_usd
  if (typeof meta.queue_ms === 'number') out.hostQueueMs = meta.queue_ms
  if (typeof meta.ttft_ms === 'number') out.hostTtftMs = meta.ttft_ms
  if (typeof meta.cli_ms === 'number') out.hostModelMs = meta.cli_ms
  return out
}

export interface TransportOptions {
  /** Calling from a web page: enables the SDK's browser mode and explains CORS failures. */
  browser?: boolean
}

const FALLBACK_MODELS = ['claude-opus-5', 'claude-fable-5-1']
const DEFAULT_TIMEOUT_MS = 30000

export class HostTimeout extends Error {
  constructor(ms = DEFAULT_TIMEOUT_MS) {
    super(`El host no respondió en ${Math.round(ms / 1000)} s. ¿Es la dirección correcta y el servicio está encendido?`)
  }
}

export const normalizeHost = (host: string) => host.trim().replace(/\/+$/, '').replace(/\/v1$/, '')

async function fetchWithTimeout(url: string, init: RequestInit & { signal?: AbortSignal }, ms = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new HostTimeout(ms)), ms)
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal
  try {
    return await fetch(url, { ...init, signal })
  } catch (err) {
    throw controller.signal.aborted ? controller.signal.reason : err
  } finally {
    clearTimeout(timer)
  }
}

const corsHint = () =>
  'No se pudo conectar desde el navegador: el host está apagado, no existe o no permite peticiones desde esta página (CORS).'

export function describeError(err: unknown, opts: TransportOptions = {}) {
  if (err instanceof Anthropic.AuthenticationError) return 'La API key no es válida.'
  if (err instanceof Anthropic.RateLimitError) return 'Límite de peticiones alcanzado; espera un momento.'
  if (err instanceof Anthropic.NotFoundError) return 'El modelo o la ruta no existen en ese host.'
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new HostTimeout().message
  if (err instanceof Anthropic.APIConnectionError && opts.browser) return corsHint()
  if (err instanceof Anthropic.APIError) return `Error ${err.status ?? ''} del proveedor: ${err.message}`.trim()
  if (err instanceof HostTimeout) return err.message
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Petición cancelada.'
    if (opts.browser && err instanceof TypeError) return corsHint()
    const cause = (err as Error & { cause?: { code?: string } }).cause?.code
    if (cause === 'ECONNREFUSED') return 'No hay nada escuchando en ese host. ¿Está encendido el servicio?'
    if (cause === 'ENOTFOUND') return 'No se encontró el host.'
    return err.message
  }
  return 'Error desconocido.'
}

/** Streams a completion, calling onText for each chunk of text; resolves with the usage the host reported. */
export async function streamCompletion(t: Target, req: CompletionRequest, onText: (text: string) => void, signal: AbortSignal, opts: TransportOptions = {}): Promise<Usage> {
  if (!t.model) throw new Error('Falta elegir un modelo.')
  return t.protocol === 'anthropic' ? streamAnthropic(t, req, onText, signal, opts) : streamOpenAI(t, req, onText, signal)
}

async function streamAnthropic(t: Target, req: CompletionRequest, onText: (text: string) => void, signal: AbortSignal, opts: TransportOptions): Promise<Usage> {
  const client = new Anthropic({ apiKey: t.apiKey, baseURL: normalizeHost(t.host), maxRetries: 1, timeout: req.timeoutMs ?? 120000, dangerouslyAllowBrowser: opts.browser })
  const withFallbacks = /api\.anthropic\.com/.test(t.host) && FALLBACK_MODELS.includes(t.model)
  const stream = client.beta.messages.stream(
    {
      model: t.model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.cache ? [{ type: 'text' as const, text: req.system, cache_control: { type: 'ephemeral' as const } }] : req.system,
      messages: [
        {
          role: 'user' as const,
          content: req.prefix
            ? [{ type: 'text' as const, text: req.prefix, ...(req.cache ? { cache_control: { type: 'ephemeral' as const } } : {}) }, { type: 'text' as const, text: req.prompt }]
            : req.prompt,
        },
      ],
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
  const { cache_read_input_tokens: read, cache_creation_input_tokens: write } = final.usage
  return { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, ...(read ? { cacheReadTokens: read } : {}), ...(write ? { cacheWriteTokens: write } : {}), ...hostCost(final) }
}

interface OpenAIChunk {
  choices?: { delta?: { content?: string }; message?: { content?: string } }[]
  usage?: {
    prompt_tokens?: number | null
    completion_tokens?: number | null
    prompt_tokens_details?: { cached_tokens?: number | null }
    completion_tokens_details?: { reasoning_tokens?: number | null }
  }
  error?: { message?: string }
  x_shellm?: ShellmMeta
}

/** OpenAI counts cached tokens inside prompt_tokens; here, as with Anthropic, inputTokens is only the uncached part. */
function openAIUsage(u: NonNullable<OpenAIChunk['usage']>): Usage {
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? 0
  return {
    ...(u.prompt_tokens != null ? { inputTokens: u.prompt_tokens - cached } : {}),
    ...(u.completion_tokens != null ? { outputTokens: u.completion_tokens } : {}),
    ...(cached ? { cacheReadTokens: cached } : {}),
    ...(reasoning ? { reasoningTokens: reasoning } : {}),
  }
}

async function streamOpenAI(t: Target, req: CompletionRequest, onText: (text: string) => void, signal: AbortSignal, includeUsage = true): Promise<Usage> {
  const response = await fetchWithTimeout(
    `${normalizeHost(t.host)}/v1/chat/completions`,
    {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', ...(t.apiKey ? { authorization: `Bearer ${t.apiKey}` } : {}) },
      body: JSON.stringify({
        model: t.model,
        stream: true,
        ...(includeUsage ? { stream_options: { include_usage: true } } : {}),
        ...(req.effort ? { reasoning_effort: req.effort } : {}),
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prefix ? `${req.prefix}\n\n${req.prompt}` : req.prompt },
        ],
      }),
    },
    req.timeoutMs,
  )
  if (!response.ok) {
    const text = await response.text()
    if (includeUsage && response.status === 400 && /stream_options/.test(text)) return streamOpenAI(t, req, onText, signal, false)
    if (response.status === 401 || response.status === 403)
      throw new Error(`El host rechazó la autenticación (${response.status}): ${t.apiKey ? 'revisa que la key sea la correcta' : 'no se envió ninguna key'}.`)
    throw new Error(`Error ${response.status} del proveedor: ${text.slice(0, 300)}`)
  }
  const usage: Usage = {}
  const absorb = (chunk: OpenAIChunk) => {
    if (chunk.error) throw new Error(chunk.error.message ?? 'Error del proveedor.')
    const text = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content
    if (text) onText(text)
    if (chunk.usage) Object.assign(usage, openAIUsage(chunk.usage))
    Object.assign(usage, hostMeta(chunk.x_shellm))
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    absorb((await response.json()) as OpenAIChunk)
    return usage
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
      absorb(JSON.parse(data) as OpenAIChunk)
    }
  }
  return usage
}

function hostCost(message: unknown): Usage {
  return hostMeta((message as { x_shellm?: ShellmMeta }).x_shellm)
}

export async function listModels(t: Target, opts: TransportOptions = {}): Promise<string[]> {
  if (t.protocol === 'anthropic') {
    const client = new Anthropic({ apiKey: t.apiKey, baseURL: normalizeHost(t.host), maxRetries: 0, timeout: DEFAULT_TIMEOUT_MS, dangerouslyAllowBrowser: opts.browser })
    const ids: string[] = []
    for await (const m of client.models.list({ limit: 100 })) ids.push(m.id)
    return ids
  }
  const response = await fetchWithTimeout(`${normalizeHost(t.host)}/v1/models`, { headers: t.apiKey ? { authorization: `Bearer ${t.apiKey}` } : {} })
  if (!response.ok) throw new Error(`Error ${response.status} al listar modelos.`)
  const json = (await response.json()) as { data?: { id: string }[] }
  return (json.data ?? []).map((m) => m.id)
}

export type StreamEvent = { type: 'delta'; text: string } | { type: 'done'; usage: Usage }

/** Async-iterable queue fed by callbacks, so push-based transports read like a stream. */
export function pushQueue<T>() {
  const items: T[] = []
  let wake: (() => void) | null = null
  let error: Error | null = null
  let closed = false
  const notify = () => {
    wake?.()
    wake = null
  }
  return {
    push: (item: T) => (items.push(item), notify()),
    fail: (err: Error) => ((error = err), notify()),
    close: () => ((closed = true), notify()),
    async *[Symbol.asyncIterator]() {
      for (;;) {
        if (items.length) yield items.shift()!
        else if (error) throw error
        else if (closed) return
        else await new Promise<void>((r) => (wake = r))
      }
    },
  }
}

/** streamCompletion as an event stream: text deltas, then the usage. */
export async function* completionEvents(t: Target, req: CompletionRequest, signal: AbortSignal, opts: TransportOptions = {}): AsyncGenerator<StreamEvent> {
  const sink = pushQueue<StreamEvent>()
  streamCompletion({ ...t, host: normalizeHost(t.host) }, req, (text) => sink.push({ type: 'delta', text }), signal, opts)
    .then((usage) => (sink.push({ type: 'done', usage }), sink.close()))
    .catch((err) => sink.fail(new Error(describeError(err, opts))))
  yield* sink
}
