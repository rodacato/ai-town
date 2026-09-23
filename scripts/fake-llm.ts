import { createServer } from 'node:http'

// OpenAI-compatible stand-in for exercising the proxy and streaming path without spending tokens.
const PORT = Number(process.env.PORT ?? 6199)
const ACTIONS = ['go', 'stay_home', 'investigate', 'ignore'] as const
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

createServer(async (req, res) => {
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
  res.end('data: [DONE]\n\n')
}).listen(PORT, () => console.log(`fake LLM on http://127.0.0.1:${PORT}`))
