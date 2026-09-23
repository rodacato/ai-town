import { useEffect } from 'react'
import { LAYOUT, useTown } from '../store'
import { HoverTag } from '../features/map/HoverTag'
import { Loader } from './Loader'
import { MapControls } from '../features/map/MapControls'
import { MapHint } from '../features/map/MapHint'
import { RightPanel } from './RightPanel'
import { SettingsModal } from '../features/settings/SettingsModal'
import { Timeline } from '../features/timeline/Timeline'
import { ResetVeil, Toasts } from './Toasts'
import { TopBar } from '../features/topbar/TopBar'
import { TownCanvas } from '../features/map/TownCanvas'

export function App() {
  useKeyboardShortcuts()
  return (
    <div
      className="app"
      style={{
        ['--panel-w' as string]: `${LAYOUT.panelWidth}px`,
        ['--gutter' as string]: `${LAYOUT.gutter}px`,
        ['--timeline-h' as string]: `${LAYOUT.timelineHeight}px`,
      }}
    >
      <TownCanvas />
      <TopBar />
      <MapControls />
      <MapHint />
      <HoverTag />
      <Timeline />
      <RightPanel />
      <Toasts />
      <ResetVeil />
      <SettingsModal />
      <Loader />
    </div>
  )
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const { renderer, settingsOpen } = useTown.getState()
      if (settingsOpen) return
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
