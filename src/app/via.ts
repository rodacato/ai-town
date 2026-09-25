/** Who answered a call: the local rules, or else the model's label. */
export const RULES = 'rules'

/** Also true for games saved before the code went English, which wrote «reglas». */
export const byRules = (via: string | undefined) => via === RULES || via === 'reglas'

/** How the interface names who answered. */
export const viaLabel = (via: string) => (byRules(via) ? 'reglas' : via)
