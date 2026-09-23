import type { Connection } from './config'

/** USD per million tokens [input, output], list prices only; anything else needs a price entered in settings. */
const KNOWN: [prefix: string, input: number, output: number][] = [
  ['claude-opus-4-5', 5, 25],
  ['claude-opus-4-6', 5, 25],
  ['claude-sonnet-4', 3, 15],
  ['claude-haiku-4-5', 1, 5],
]

export interface Price {
  input: number
  output: number
}

export function knownPrice(model: string): Price | null {
  const hit = KNOWN.find(([prefix]) => model.startsWith(prefix))
  return hit ? { input: hit[1], output: hit[2] } : null
}

/** The price to estimate with: the user's override for this connection, else the known list price for its model. */
export function priceFor(c: Connection): Price | null {
  if (c.priceIn !== undefined && c.priceOut !== undefined) return { input: c.priceIn, output: c.priceOut }
  return c.kind === 'anthropic' ? knownPrice(c.model) : null
}

export function estimateCost(price: Price | null, inputTokens?: number, outputTokens?: number) {
  if (!price || inputTokens === undefined || outputTokens === undefined) return undefined
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}
