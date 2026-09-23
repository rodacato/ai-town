import type { Action } from '../../core/decisions/types'
import { ACTION_META } from '../../theme/actions'

export function ActionPill({ action, short = false }: { action: Action; short?: boolean }) {
  const meta = ACTION_META[action]
  return (
    <span className="action-pill" style={{ ['--c' as string]: meta.css }}>
      <span className="action-dot" />
      {short ? meta.short : meta.label}
    </span>
  )
}
