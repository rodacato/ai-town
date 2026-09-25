import { createServer } from 'node:http'

// OpenAI-compatible stand-in for exercising the proxy and streaming path without spending tokens.
// FAKE_KEY=… makes it demand that bearer key, to rehearse auth failures.
const PORT = Number(process.env.PORT ?? 6199)
const ACTIONS = ['go', 'stay_home', 'investigate', 'ignore'] as const
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let active = 0
let peak = 0

createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if (process.env.FAKE_KEY && req.headers.authorization !== `Bearer ${process.env.FAKE_KEY}`) {
    res.statusCode = 401
    return res.end(JSON.stringify({ error: { message: 'Invalid API key' } }))
  }
  if (req.url === '/v1/models') {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ data: [{ id: 'fake-town-1' }, { id: 'fake-town-mini' }] }))
  }
  if (req.url !== '/v1/chat/completions' || req.method !== 'POST') {
    res.statusCode = 404
    return res.end()
  }
  let body = ''
  for await (const chunk of req) body += chunk
  active++
  peak = Math.max(peak, active)
  console.log(`active ${active} · peak ${peak}`)
  const parsed = JSON.parse(body) as { messages: { role: string; content: string }[]; reasoning_effort?: string }
  const messages = parsed.messages
  const prompt = messages.at(-1)!.content
  const system = messages.find((m) => m.role === 'system')?.content ?? ''
  const name = /^(.+?), \d+ años/m.exec(prompt)?.[1] ?? 'Alguien'
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
  const decision = {
    reasoning: `Soy ${name} y esto me hace pensar. No sé si fiarme del todo, pero tomaré una decisión con calma y sin prisas.`,
    action,
    believes: Math.random() > 0.4,
    tell: [],
    speech: action === 'go' ? '¡Voy para allá!' : action === 'stay_home' ? 'Me quedo en casa.' : action === 'investigate' ? 'A ver qué pasa…' : 'Paso.',
    emoji: action === 'go' ? '🏃' : action === 'stay_home' ? '🏠' : action === 'investigate' ? '🔍' : '🤷',
    confidence: Math.round(Math.random() * 100) / 100,
  }
  // It answers in the shape each caller asks for: a resident, the ruler, the judge of character or a petitioner.
  const text = system.startsWith('Evalúas personajes')
    ? JSON.stringify({ puntaje: 1 + Math.floor(Math.random() * 5), razon: 'Suena más o menos como el personaje.' })
    : system.includes(' y gobiernas ')
      ? JSON.stringify({ pensamiento: 'Hoy compro un poco de grano, por si acaso.', acciones: [{ tipo: 'comprar_comida', raciones: 10 }] })
      : system.includes('pedirle algo')
        ? JSON.stringify({ peticion: `Soy ${/^Eres ([^,]+),/m.exec(prompt)?.[1] ?? name}, mi señora, y vengo a pediros ayuda con lo mío.` })
        : JSON.stringify(decision)
  // Like SheLLM 1.16: comment lines while queued or silent, more thinking at a higher effort, and its x_shellm block at the end.
  const effort = parsed.reasoning_effort ?? 'medium'
  const thinking = { minimal: 150, low: 300, medium: 800, high: 1600 }[effort] ?? 800
  const queued = Math.max(0, active - 4) * 300
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  if (queued) res.write(`: queued position=${active - 4}\n\n`)
  const t0 = Date.now()
  await sleep(queued + thinking + Math.random() * thinking)
  res.write(': keepalive\n\n')
  const ttft = Date.now() - t0
  for (let i = 0; i < text.length; i += 6) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 6) } }] })}\n\n`)
    await sleep(25)
  }
  const reasoning = Math.round(thinking / 10)
  const usage = { prompt_tokens: 900, completion_tokens: Math.round(text.length / 4) + reasoning, prompt_tokens_details: { cached_tokens: 600 }, completion_tokens_details: { reasoning_tokens: reasoning } }
  const x_shellm = { cost_usd: null, queue_ms: queued, ttft_ms: ttft, cli_ms: Date.now() - t0 - queued }
  res.write(`data: ${JSON.stringify({ choices: [], usage, x_shellm })}\n\n`)
  res.end('data: [DONE]\n\n')
  active--
}).listen(PORT, () => console.log(`fake LLM on http://127.0.0.1:${PORT}`))
