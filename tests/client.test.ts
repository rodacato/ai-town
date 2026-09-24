import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/providers/llm/config'

/** Stands in for the dev server's single event stream; tests push messages through `emit`. */
class FakeEventSource {
  static last: FakeEventSource
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(readonly url: string) {
    FakeEventSource.last = this
    queueMicrotask(() => this.emit({ type: 'hello', channel: 'ch-1' }))
  }
  emit(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
  close() {
    this.closed = true
  }
}

const connection = { ...DEFAULT_SETTINGS.connections.shellm, model: 'claude' }
let posts: { url: string; body: Record<string, string> }[]

beforeEach(() => {
  vi.resetModules()
  posts = []
  vi.stubGlobal('EventSource', FakeEventSource)
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.endsWith('health')) return Response.json({ ok: true })
    posts.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
    return new Response(null, { status: 202 })
  })
})
afterEach(() => vi.unstubAllGlobals())

const until = async (cond: () => boolean) => {
  for (let i = 0; i < 50 && !cond(); i++) await new Promise((r) => setTimeout(r, 1))
}

describe('proxy channel', () => {
  it('routes interleaved output of concurrent decisions to the right one', async () => {
    const { streamChat, transportMode } = await import('../src/providers/llm/client')
    expect(await transportMode()).toBe('proxy')
    const read = async (it: AsyncGenerator<{ type: string; text?: string }>) => {
      let text = ''
      for await (const e of it) if (e.type === 'delta') text += e.text
      return text
    }
    const a = read(streamChat(connection, 'sys', 'A', new AbortController().signal))
    const b = read(streamChat(connection, 'sys', 'B', new AbortController().signal))
    await until(() => posts.length === 2)
    const [jobA, jobB] = posts.map((p) => p.body.job)
    expect(posts.every((p) => p.body.channel === 'ch-1')).toBe(true)
    const src = FakeEventSource.last
    src.emit({ type: 'delta', job: jobA, delta: 'uno ' })
    src.emit({ type: 'delta', job: jobB, delta: 'dos ' })
    src.emit({ type: 'delta', job: jobA, delta: 'más' })
    src.emit({ type: 'done', job: jobB, usage: {} })
    src.emit({ type: 'done', job: jobA, usage: {} })
    expect(await a).toBe('uno más')
    expect(await b).toBe('dos ')
  })

  it('passes a job error to that job only', async () => {
    const { streamChat } = await import('../src/providers/llm/client')
    const it = streamChat(connection, 'sys', 'A', new AbortController().signal)
    const next = it.next()
    await until(() => posts.length === 1)
    FakeEventSource.last.emit({ type: 'error', job: posts[0].body.job, error: 'El host rechazó la autenticación (401)' })
    await expect(next).rejects.toThrow('401')
  })

  it('tells the server to cancel when a decision is aborted', async () => {
    const { streamChat } = await import('../src/providers/llm/client')
    const controller = new AbortController()
    const next = streamChat(connection, 'sys', 'A', controller.signal).next()
    await until(() => posts.length === 1)
    controller.abort()
    await expect(next).rejects.toThrow()
    await until(() => posts.length === 2)
    expect(posts[1]).toMatchObject({ url: expect.stringContaining('cancel'), body: { channel: 'ch-1', job: posts[0].body.job } })
  })

  it('fails every open decision if the channel drops', async () => {
    const { streamChat } = await import('../src/providers/llm/client')
    const next = streamChat(connection, 'sys', 'A', new AbortController().signal).next()
    await until(() => posts.length === 1)
    FakeEventSource.last.onerror?.()
    await expect(next).rejects.toThrow('Se perdió la conexión')
    expect(FakeEventSource.last.closed).toBe(true)
  })

  it('goes direct when there is no local server, as on GitHub Pages', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    const { transportMode } = await import('../src/providers/llm/client')
    expect(await transportMode()).toBe('direct')
  })
})
