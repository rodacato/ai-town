import { useEffect } from 'react'

/** Below this width the panel becomes a bottom sheet and the top bar folds into two rows; keep in step with compact.css. */
export const COMPACT = '(max-width: 900px)'

/** Publishes how tall the top bar and the bottom sheet are, so the map, the timeline and the toasts can sit around them. */
export function useLayoutVars(onChange: () => void) {
  useEffect(() => {
    const root = document.documentElement
    let last = ''
    const measure = () => {
      const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 60
      const hud = document.querySelector('.realm-hud')?.getBoundingClientRect().bottom ?? 0
      const sheet = matchMedia(COMPACT).matches ? (document.querySelector('.right-column')?.getBoundingClientRect().height ?? 0) : 0
      root.style.setProperty('--top-h', `${Math.round(top)}px`)
      root.style.setProperty('--sheet-h', `${Math.round(sheet)}px`)
      root.style.setProperty('--hud-h', `${Math.round(Math.max(top, hud))}px`)
      const now = `${Math.round(top)}:${Math.round(hud)}:${Math.round(sheet)}`
      if (now !== last) onChange()
      last = now
    }
    measure()
    const watch = new ResizeObserver(measure)
    for (const sel of ['.topbar', '.right-column', '.realm-hud']) {
      const el = document.querySelector(sel)
      if (el) watch.observe(el)
    }
    window.addEventListener('resize', measure)
    return () => {
      watch.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [onChange])
}
