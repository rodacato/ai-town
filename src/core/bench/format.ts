import { ACTIONS } from '../decisions/types'

export type FormatStatus = 'ok' | 'repaired' | 'invalid'

export interface FormatCheck {
  status: FormatStatus
  issues: string[]
}

/** How closely a raw reply follows the requested JSON: 'repaired' means the app had to guess or fix something. */
export function checkFormat(text: string): FormatCheck {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return { status: 'invalid', issues: ['sin JSON'] }
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    return { status: 'invalid', issues: ['JSON inválido'] }
  }
  const issues: string[] = []
  if (start > 0 || end < trimmed.length - 1) issues.push('texto fuera del JSON')
  if (!ACTIONS.includes(raw.action as never)) issues.push('acción desconocida')
  if (typeof raw.believes !== 'boolean') issues.push('believes no es booleano')
  if (typeof raw.reasoning !== 'string' || !raw.reasoning.trim()) issues.push('sin razonamiento')
  if (typeof raw.speech !== 'string' || !raw.speech.trim()) issues.push('sin frase')
  else if (raw.speech.length > 60) issues.push('frase demasiado larga')
  if (typeof raw.confidence !== 'number' || raw.confidence < 0 || raw.confidence > 1) issues.push('confianza fuera de 0–1')
  if (raw.action === 'warn' && !(Array.isArray(raw.tell) && raw.tell.length)) issues.push('avisar sin a quién')
  return { status: issues.length ? 'repaired' : 'ok', issues }
}
