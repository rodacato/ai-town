import { afterEach, describe, expect, it, vi } from 'vitest'
import { completionEvents, describeError, HostTimeout, normalizeHost, streamCompletion, type Target } from '../src/providers/llm/transport'

const target: Target = { kind: 'shellm', protocol: 'openai', host: 'http://127.0.0.1:6100/v1/', apiKey: 'sk-test', model: 'claude' }
const req = { system: 'sys', prompt: 'hola', timeoutMs: 2000 }

/** A streamed HTTP response delivered in the given pieces, the way sockets split it. */
function sse(pieces: string[], status = 200) {
  const body = new ReadableStream({
    start(c) {
      for (const p of pieces) c.enqueue(new TextEncoder().encode(p))
      c.close()
    },
  })
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } })
}

const chunk = (obj: object) => `data: ${JSON.stringify(obj)}\n\n`

afterEach(() => vi.unstubAllGlobals())

describe('OpenAI-compatible streaming', () => {
  it('joins text split across network chunks and reports usage and host cost', async () => {
    const whole = chunk({ choices: [{ delta: { content: '{"reasoning": "Voy' } }] }) + chunk({ choices: [{ delta: { content: ' ya"}' } }] }) + chunk({ usage: { prompt_tokens: 120, completion_tokens: 30 }, x_shellm: { cost_usd: 0.004 } }) + 'data: [DONE]\n\n'
    const fetch = vi.fn(async () => sse([whole.slice(0, 23), whole.slice(23, 71), whole.slice(71)]))
    vi.stubGlobal('fetch', fetch)
    let text = ''
    const usage = await streamCompletion(target, req, (t) => (text += t), new AbortController().signal)
    expect(text).toBe('{"reasoning": "Voy ya"}')
    expect(usage).toEqual({ inputTokens: 120, outputTokens: 30, costUsd: 0.004 })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:6100/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test')
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'claude', stream: true, stream_options: { include_usage: true } })
  })

  it('retries without stream_options when an older host rejects them', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('unknown field stream_options', { status: 400 }))
      .mockResolvedValueOnce(sse([chunk({ choices: [{ delta: { content: 'ok' } }] })]))
    vi.stubGlobal('fetch', fetch)
    let text = ''
    await streamCompletion(target, req, (t) => (text += t), new AbortController().signal)
    expect(text).toBe('ok')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).not.toHaveProperty('stream_options')
  })

  it('reads a plain JSON reply from hosts that ignore streaming', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ choices: [{ message: { content: 'entero' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }))
    let text = ''
    const usage = await streamCompletion(target, req, (t) => (text += t), new AbortController().signal)
    expect(text).toBe('entero')
    expect(usage).toEqual({ inputTokens: 5, outputTokens: 2 })
  })

  it('explains an auth failure and says whether a key was sent', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 401 }))
    await expect(streamCompletion(target, req, () => {}, new AbortController().signal)).rejects.toThrow('revisa que la key sea la correcta')
    await expect(streamCompletion({ ...target, apiKey: '' }, req, () => {}, new AbortController().signal)).rejects.toThrow('no se envió ninguna key')
  })

  it('surfaces an error the host sends inside the stream', async () => {
    vi.stubGlobal('fetch', async () => sse([chunk({ error: { message: 'queue full' } })]))
    await expect(streamCompletion(target, req, () => {}, new AbortController().signal)).rejects.toThrow('queue full')
  })

  it('refuses to call without a model', async () => {
    await expect(streamCompletion({ ...target, model: '' }, req, () => {}, new AbortController().signal)).rejects.toThrow('Falta elegir un modelo')
  })

  it('gives up on a host that never answers', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
    await expect(streamCompletion(target, { ...req, timeoutMs: 30 }, () => {}, new AbortController().signal)).rejects.toBeInstanceOf(HostTimeout)
  })

  it('turns the stream into delta and done events', async () => {
    vi.stubGlobal('fetch', async () => sse([chunk({ choices: [{ delta: { content: 'a' } }] }), chunk({ choices: [{ delta: { content: 'b' } }] })]))
    const events = []
    for await (const e of completionEvents(target, req, new AbortController().signal)) events.push(e)
    expect(events).toEqual([{ type: 'delta', text: 'a' }, { type: 'delta', text: 'b' }, { type: 'done', usage: {} }])
  })
})

describe('host and error helpers', () => {
  it('normalizes hosts written with trailing slashes or /v1', () => {
    expect(normalizeHost(' http://h:6100/v1/ ')).toBe('http://h:6100')
    expect(normalizeHost('https://api.anthropic.com')).toBe('https://api.anthropic.com')
  })

  it('translates low-level failures into Spanish advice', () => {
    const refused = Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    expect(describeError(refused)).toMatch(/No hay nada escuchando/)
    expect(describeError(new TypeError('Failed to fetch'), { browser: true })).toMatch(/CORS/)
    expect(describeError(new DOMException('x', 'AbortError'))).toBe('Petición cancelada.')
    expect(describeError('raro')).toBe('Error desconocido.')
  })
})
