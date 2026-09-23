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
  const prompt: string = JSON.parse(body).messages.at(-1).content
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
  const text = JSON.stringify(decision)
  await sleep(400 + Math.random() * 1200)
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  for (let i = 0; i < text.length; i += 6) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 6) } }] })}\n\n`)
    await sleep(25)
  }
  res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 900, completion_tokens: text.length / 4 } })}\n\n`)
  res.end('data: [DONE]\n\n')
  active--
}).listen(PORT, () => console.log(`fake LLM on http://127.0.0.1:${PORT}`))
