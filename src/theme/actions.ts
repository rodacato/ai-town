import type { Action } from '../core/decisions/types'

export const ACTION_META: Record<Action, { label: string; short: string; color: number; css: string }> = {
  go: { label: 'Va al lugar', short: 'Va', color: 0x7fa876, css: '#7fa876' },
  stay_home: { label: 'Se queda en casa', short: 'En casa', color: 0x6fa8c7, css: '#6fa8c7' },
  warn: { label: 'Avisa a otros', short: 'Avisa', color: 0xd9a441, css: '#d9a441' },
  investigate: { label: 'Investiga', short: 'Investiga', color: 0x9a7ab8, css: '#9a7ab8' },
  ignore: { label: 'Sigue con su día', short: 'No va', color: 0xa39a90, css: '#a39a90' },
}
