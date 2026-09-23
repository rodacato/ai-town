import { useTown } from '../store'

export function Toasts() {
  const toasts = useTown((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function ResetVeil() {
  const resetting = useTown((s) => s.resetting)
  return <div className={`reset-veil ${resetting ? 'is-on' : ''}`} aria-hidden />
}
