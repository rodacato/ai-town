import type { Bond } from './memory'

const COLD_WORDS = ['rival', 'no le cae', 'critica', 'usurpadora', 'desconfianza', 'vigila', 'rencor', 'no se fía']

/** Whether a relationship leans friendly; a label that names no quarrel counts as friendly. */
export const isWarm = (label: string) => !COLD_WORDS.some((w) => label.includes(w))

/** How a relationship moved away from the one the resident started with. */
export type Turn = 'broken' | 'mended' | 'befriended' | 'resented'

export interface LiveRelation {
  id: string
  label: string
  /** The relationship as written in the world, if there was one. */
  base: string | null
  turn?: Turn
}

/** Lies that break a friendship, and true warnings that mend a quarrel or make a new friend. */
const BREAK_AFTER = 2
const MEND_AFTER = 2

const times = (n: number) => (n === 1 ? 'una vez' : `${n} veces`)

/** A resident's relationships as they stand now: the written ones, bent by who lied to them and who warned them. */
export function livingRelations(base: { id: string; label: string }[], bonds: Map<string, Bond>): LiveRelation[] {
  const out: LiveRelation[] = base.map((rel) => {
    const b = bonds.get(rel.id)
    if (!b) return { ...rel, base: rel.label }
    const warm = isWarm(rel.label)
    if (warm && b.misled >= BREAK_AFTER && b.misled > b.warned) return { id: rel.id, label: `ya no se fía: le pasó mentiras ${times(b.misled)}`, base: rel.label, turn: 'broken' }
    if (!warm && b.warned >= MEND_AFTER && b.warned > b.misled) return { id: rel.id, label: `hicieron las paces: le avisó a tiempo ${times(b.warned)}`, base: rel.label, turn: 'mended' }
    return { ...rel, base: rel.label }
  })
  for (const [id, b] of bonds) {
    if (base.some((rel) => rel.id === id)) continue
    if (b.warned >= MEND_AFTER && b.warned > b.misled) out.push({ id, label: `amistad nueva: le avisó a tiempo ${times(b.warned)}`, base: null, turn: 'befriended' })
    else if (b.misled > b.warned) out.push({ id, label: `le guarda rencor: le pasó mentiras ${times(b.misled)}`, base: null, turn: 'resented' })
  }
  return out
}

const TURN_TEXT: Record<Turn, (who: string, other: string) => string> = {
  broken: (who, other) => `${who} ya no se fía de ${other}`,
  mended: (who, other) => `${who} hizo las paces con ${other}`,
  befriended: (who, other) => `${who} y ${other} se hicieron amigos`,
  resented: (who, other) => `${who} le guarda rencor a ${other}`,
}

/** The relationships that took a new turn between two readings, in words for the chronicle. */
export function turnsBetween(before: LiveRelation[], after: LiveRelation[], who: string, nameOf: (id: string) => string): string[] {
  return after.filter((rel) => rel.turn && before.find((b) => b.id === rel.id)?.turn !== rel.turn).map((rel) => TURN_TEXT[rel.turn!](who, nameOf(rel.id)))
}
