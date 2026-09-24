/** How figures read everywhere: in the app, the log, the throne and the terminal. */

/** Dollars with enough decimals to see a cent's fraction; `null` is «sin precio», never $0. */
export function usd(v: number | null | undefined, estimated = false) {
  if (v === null || v === undefined) return 'sin precio'
  const text = v === 0 ? '$0' : `$${v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3) : v.toFixed(2)}`
  return estimated && v !== 0 ? `≈ ${text}` : text
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`

export const tokens = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

/** Cuts long text for a line, with an ellipsis. */
export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
