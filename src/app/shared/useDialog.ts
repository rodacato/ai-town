import { useEffect, useRef } from 'react'

/** Escape closes, Tab stays inside, and focus returns to where it was when the dialog closes. */
export function useDialog<T extends HTMLElement>(onClose: () => void, initialFocus = 'button') {
  const ref = useRef<T>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>(initialFocus)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab' || !ref.current) return
      const focusable = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])')]
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
      previous?.focus()
    }
  }, [onClose, initialFocus])
  return ref
}
