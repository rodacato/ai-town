import type { Decision, DecisionContext } from '../types'

/** Reads the value of a JSON string field from a possibly incomplete JSON document, so reasoning can stream. */
export function partialStringField(json: string, key: string) {
  const match = new RegExp(`"${key}"\\s*:\\s*"`).exec(json)
  if (!match) return ''
  let out = ''
  for (let i = match.index + match[0].length; i < json.length; i++) {
    const ch = json[i]
    if (ch === '"') break
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = json[i + 1]
    if (next === undefined) break
    if (next === 'u') {
      const hex = json.slice(i + 2, i + 6)
      if (hex.length < 4) break
      out += String.fromCharCode(parseInt(hex, 16))
      i += 5
    } else {
      out += { n: '\n', t: '\t', r: '', b: '', f: '' }[next] ?? next
      i += 1
    }
  }
  return out
}

export function parseDecision(text: string, ctx: DecisionContext): Decision {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('El modelo no devolvió JSON.')
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    throw new Error('El modelo devolvió un JSON inválido.')
  }
  const byName = (value: string) => {
    const v = value.toLowerCase().trim()
    return ctx.townsfolk.find((p) => p.id === v || p.name.toLowerCase() === v || p.name.split(' ')[0].toLowerCase() === v)?.id
  }
  return {
    action: raw.action as Decision['action'],
    believes: raw.believes !== false,
    tell: (Array.isArray(raw.tell) ? raw.tell : []).map((t) => byName(String(t))).filter((id): id is string => !!id),
    reasoning: String(raw.reasoning ?? ''),
    speech: String(raw.speech ?? ''),
    emoji: String(raw.emoji ?? ''),
    confidence: Number(raw.confidence),
  }
}
