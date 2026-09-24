import type { DayRecord } from '../../../core/realm/reign'

export interface DuelSeries {
  id: string
  label: string
  /** Index into the fixed categorical order, so a ruler keeps its color in every chart. */
  slot: number
  days: DayRecord[]
}

const W = 320
const H = 150
const PAD = { left: 34, right: 8, top: 10, bottom: 22 }

/** One measure over the year, one line per ruler; the hovered day is shared with the other charts. */
export function DuelChart({
  title,
  series,
  days,
  read,
  max,
  format,
  hover,
  active,
  onHover,
}: {
  title: string
  series: DuelSeries[]
  days: number
  read: (d: DayRecord) => number
  max: number
  format: (v: number) => string
  hover: number | null
  /** This chart is the one under the pointer, so it carries the tooltip. */
  active: boolean
  onHover: (day: number | null) => void
}) {
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (day: number) => PAD.left + (day / Math.max(1, days - 1)) * plotW
  const y = (v: number) => PAD.top + plotH - (Math.min(max, Math.max(0, v)) / (max || 1)) * plotH
  const ticks = [0, 0.5, 1].map((k) => k * max)
  const seasons = Array.from({ length: Math.floor((days - 1) / 10) + 1 }, (_, i) => i * 10)

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const day = Math.round(((px - PAD.left) / plotW) * (days - 1))
    onHover(day >= 0 && day < days ? day : null)
  }

  const at = hover === null ? [] : series.map((s) => ({ s, d: s.days.find((d) => d.day === hover) })).filter((r): r is { s: DuelSeries; d: DayRecord } => !!r.d)

  return (
    <figure className="duel-chart">
      <figcaption>{title}</figcaption>
      <div className="duel-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} de cada gobernante a lo largo del año`} onPointerMove={move} onPointerLeave={() => onHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="duel-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="duel-axis" x={PAD.left - 5} y={y(t) + 3.5} textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          {seasons.map((d) => (
            <text key={d} className="duel-axis" x={x(d)} y={H - 6} textAnchor="middle">
              {d + 1}
            </text>
          ))}
          {series.map((s) => (
            <polyline key={s.id} className="duel-line" style={{ stroke: `var(--series-${s.slot + 1})` }} points={s.days.map((d) => `${x(d.day).toFixed(1)},${y(read(d)).toFixed(1)}`).join(' ')} />
          ))}
          {hover !== null && <line className="duel-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} />}
          {at.map(({ s, d }) => (
            <circle key={s.id} className="duel-dot" cx={x(d.day)} cy={y(read(d))} r={4} style={{ fill: `var(--series-${s.slot + 1})` }} />
          ))}
        </svg>
        {active && hover !== null && at.length > 0 && (
          <div className="duel-tip" style={x(hover) / W > 0.55 ? { right: `${(1 - x(hover) / W) * 100}%`, transform: 'translateX(-8px)' } : { left: `${(x(hover) / W) * 100}%` }} role="status">
            <b>Día {hover + 1}</b>
            {at.map(({ s, d }) => (
              <span key={s.id}>
                <i style={{ background: `var(--series-${s.slot + 1})` }} aria-hidden />
                {s.label} <span className="mono">{format(read(d))}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
