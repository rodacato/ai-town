import { lazy, Suspense, useEffect } from 'react'
import { useTown } from '../store'
import { LAYOUT, town } from '../town'
import { HoverTag } from '../features/map/HoverTag'
import { Loader } from './Loader'
import { MapControls } from '../features/map/MapControls'
import { MapHint } from '../features/map/MapHint'
import { RightPanel } from './RightPanel'
import { LiveAnnouncer } from './LiveAnnouncer'
import { Timeline } from '../features/timeline/Timeline'
import { ResetVeil, Toasts } from './Toasts'
import { TopBar } from '../features/topbar/TopBar'
import { TownCanvas } from '../features/map/TownCanvas'
import './shell.css'

const SettingsModal = lazy(() => import('../features/settings/SettingsModal').then((m) => ({ default: m.SettingsModal })))

function LazySettings() {
  const open = useTown((s) => s.settingsOpen)
  return open ? (
    <Suspense fallback={null}>
      <SettingsModal />
    </Suspense>
  ) : null
}

export function App() {
  useKeyboardShortcuts()
  useEffect(() => {
    document.title = `AI Town · ${town.content.name}`
  }, [])
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
      <LazySettings />
      <LiveAnnouncer />
      <Loader />
    </div>
  )
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (useTown.getState().settingsOpen) return
      if (e.key === 'Escape') town.select(null)
      if (e.key === '+' || e.key === '=') town.zoomBy(1.25)
      if (e.key === '-') town.zoomBy(0.8)
      if (e.key === '0') town.fit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
