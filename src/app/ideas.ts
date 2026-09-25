import { viaLabel } from './via'
import type { Letter } from './store/reign'

const KEY = 'ai-town:ideas'

/** Letters the creator kept as ideas outlive the game they came from; unreadable or blocked storage just means none. */
export function loadIdeas(): Letter[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { ideas?: Letter[] } | null
    return Array.isArray(saved?.ideas) ? saved.ideas : []
  } catch {
    return []
  }
}

export function saveIdeas(ideas: Letter[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ideas }))
  } catch {
    // The ideas still live in this tab.
  }
}

/** A stable key for a letter, including ones saved before letters had ids. */
export const letterKey = (l: Letter) => l.id ?? `${l.day}:${l.text.slice(0, 60)}`

/** The letters as Markdown, to take them somewhere else: an issue, a note, a conversation. */
export function lettersMarkdown(letters: Letter[], title: string) {
  const lines = [`# ${title}`, '']
  for (const l of letters) {
    lines.push(`## Día ${l.day + 1}${l.via ? ` · ${viaLabel(l.via)}` : ''}${l.idea ? ' · 💡 idea' : ''}`, '', `> ${l.text.replace(/\n/g, '\n> ')}`, '')
    if (l.reply) lines.push(`**Respuesta:** ${l.reply}`, '')
  }
  return lines.join('\n')
}
