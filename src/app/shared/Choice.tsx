import type { ReactNode } from 'react'

/** A segmented single choice; the thumb hides when the value matches none of the options. */
export function Choice<T>({ label, options, value, onPick, render }: { label: string; options: T[]; value: T; onPick: (v: T) => void; render: (v: T) => ReactNode }) {
  const active = options.indexOf(value)
  return (
    <div className="segmented" role="radiogroup" aria-label={label} style={{ ['--cols' as string]: options.length, ['--active' as string]: active }}>
      {active >= 0 && <span className="segmented-thumb" aria-hidden />}
      {options.map((o, i) => (
        <button key={i} role="radio" aria-checked={i === active} className={i === active ? 'is-active' : ''} onClick={() => onPick(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  )
}
