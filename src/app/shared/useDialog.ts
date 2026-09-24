import { useEffect, useRef } from 'react'

/** Escape closes, Tab stays inside, and focus returns to where it was when the dialog closes. */
export function useDialog<T extends HTMLElement>(onClose: () => void, initialFocus = 'button') {
  const ref = useRef<T>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const hidden = silenceBehind(ref.current)
    ref.current?.querySelector<HTMLElement>(initialFocus)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab' || !ref.current) return
      const focusable = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      for (const el of hidden) el.inert = false
      previous?.focus()
    }
  }, [onClose, initialFocus])
  return ref
}

/** Makes everything behind a dialog inert, so screen readers and Tab stay in it; live regions keep talking. */
function silenceBehind(dialog: HTMLElement | null): HTMLElement[] {
  const layer = dialog?.closest<HTMLElement>('.modal-backdrop') ?? dialog
  if (!layer?.parentElement) return []
  const hidden: HTMLElement[] = []
  const quiet = (children: HTMLElement[]) => {
    for (const el of children) {
      if (el === layer || el.inert || el.matches(LIVE)) continue
      if (el.contains(layer) || el.querySelector(LIVE)) quiet([...el.children] as HTMLElement[])
      else {
        el.inert = true
        hidden.push(el)
      }
    }
  }
  quiet([...layer.parentElement.children] as HTMLElement[])
  return hidden
}

const LIVE = '[aria-live], [role=status]'
