import { useEffect } from 'react'
import { useTown } from './store'
import { HoverTag } from './ui/HoverTag'
import { Loader } from './ui/Loader'
import { MapControls } from './ui/MapControls'
import { MapHint } from './ui/MapHint'
import { ResidentCard } from './ui/ResidentCard'
import { TopBar } from './ui/TopBar'
import { TownCanvas } from './ui/TownCanvas'

export function App() {
  useKeyboardShortcuts()
  return (
    <div className="app">
      <TownCanvas />
      <TopBar />
      <MapControls />
      <MapHint />
      <HoverTag />
      <ResidentCard />
      <Loader />
    </div>
  )
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const { renderer } = useTown.getState()
      if (!renderer) return
      if (e.key === 'Escape') renderer.select(null)
      if (e.key === '+' || e.key === '=') renderer.camera.zoomBy(1.25)
      if (e.key === '-') renderer.camera.zoomBy(0.8)
      if (e.key === '0') renderer.camera.fit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
