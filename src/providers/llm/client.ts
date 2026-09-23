import type { Connection } from './config'
import { describeError, listModels, normalizeHost, streamCompletion, type CompletionRequest, type Usage } from './transport'

export type TransportMode = 'proxy' | 'direct'

export type StreamEvent = { type: 'delta'; text: string } | { type: 'done'; usage: Usage }

const api = (path: string) => `${import.meta.env.BASE_URL}api/llm/${path}`

let modePromise: Promise<TransportMode> | null = null

/** 'proxy' when the local dev server is there to relay requests; 'direct' on static hosting like GitHub Pages. */
export function transportMode(): Promise<TransportMode> {
  modePromise ??= fetch(api('health'))
    .then((r) => (r.ok ? r.json() : null))
    .then((body: { ok?: boolean } | null) => (body?.ok ? 'proxy' : 'direct') as TransportMode)
    .catch(() => 'direct' as TransportMode)
  return modePromise
}

/** Async-iterable queue fed by callbacks, so push-based transports read like a stream. */
function pushQueue<T>() {
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

type Sink = ReturnType<typeof pushQueue<StreamEvent>>

/** One event stream per tab carries the output of every in-flight decision. */
class ProxyChannel {
  private id: Promise<string> | null = null
  private sinks = new Map<string, Sink>()

  private connect() {
    if (this.id) return this.id
    this.id = new Promise<string>((resolve, reject) => {
      const source = new EventSource(api('channel'))
      source.onmessage = (e) => {
        const msg = JSON.parse(e.data) as { type: string; channel?: string; job?: string; delta?: string; usage?: Usage; error?: string }
        if (msg.type === 'hello') return resolve(msg.channel!)
        const sink = this.sinks.get(msg.job!)
        if (!sink) return
        if (msg.type === 'delta') sink.push({ type: 'delta', text: msg.delta! })
        if (msg.type === 'done') sink.push({ type: 'done', usage: msg.usage ?? {} }), sink.close(), this.sinks.delete(msg.job!)
        if (msg.type === 'error') sink.fail(new Error(msg.error)), this.sinks.delete(msg.job!)
      }
      source.onerror = () => {
        for (const sink of this.sinks.values()) sink.fail(new Error('Se perdió la conexión con el servidor local.'))
        this.sinks.clear()
        source.close()
        this.id = null
        reject(new Error('No se pudo abrir el canal con el servidor local.'))
      }
    })
    return this.id
  }

  async *stream(connection: Connection, req: CompletionRequest, signal: AbortSignal, tag?: string): AsyncGenerator<StreamEvent> {
    const channel = await this.connect()
    const job = crypto.randomUUID()
    const sink = pushQueue<StreamEvent>()
    this.sinks.set(job, sink)
    const cancel = () => {
      this.sinks.delete(job)
      void fetch(api('cancel'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel, job }) })
      sink.fail(signal.reason instanceof Error ? signal.reason : new DOMException('Petición cancelada.', 'AbortError'))
    }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      const res = await fetch(api('job'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel, job, connection, tag, ...req }),
      })
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `El servidor local respondió ${res.status}.`)
      yield* sink
    } finally {
      signal.removeEventListener('abort', cancel)
      this.sinks.delete(job)
    }
  }
}

const channel = new ProxyChannel()

async function* direct(connection: Connection, req: CompletionRequest, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const sink = pushQueue<StreamEvent>()
  streamCompletion({ ...connection, host: normalizeHost(connection.host) }, req, (text) => sink.push({ type: 'delta', text }), signal, { browser: true })
    .then((usage) => (sink.push({ type: 'done', usage }), sink.close()))
    .catch((err) => sink.fail(new Error(describeError(err, { browser: true }))))
  yield* sink
}

/** Streams a completion through the local proxy when there is one, or straight from the browser otherwise. */
export async function* streamChat(connection: Connection, system: string, prompt: string, signal: AbortSignal, opts: { maxTokens?: number; tag?: string; timeoutMs?: number } = {}): AsyncGenerator<StreamEvent> {
  const req: CompletionRequest = { system, prompt, maxTokens: opts.maxTokens, timeoutMs: opts.timeoutMs }
  if ((await transportMode()) === 'proxy') yield* channel.stream(connection, req, signal, opts.tag)
  else yield* direct(connection, req, signal)
}

export async function fetchModels(connection: Connection): Promise<string[]> {
  if ((await transportMode()) === 'direct') {
    try {
      return await listModels({ ...connection, host: normalizeHost(connection.host) }, { browser: true })
    } catch (err) {
      throw new Error(describeError(err, { browser: true }))
    }
  }
  const res = await fetch(api('models'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ connection }) })
  const json = (await res.json()) as { models?: string[]; error?: string }
  if (!res.ok || json.error) throw new Error(json.error ?? `Error ${res.status}`)
  return json.models ?? []
}
