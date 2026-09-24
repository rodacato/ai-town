import { lazy, Suspense, useEffect } from 'react'
import { useTown } from '../store'
import { useBench } from '../features/bench/benchStore'
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
import { GodPanel } from '../features/god/GodPanel'
import { RealmHud } from '../features/realm/RealmHud'
import './shell.css'

const SettingsModal = lazy(() => import('../features/settings/SettingsModal').then((m) => ({ default: m.SettingsModal })))

const BenchModal = lazy(() => import('../features/bench/BenchModal').then((m) => ({ default: m.BenchModal })))

function LazyBench() {
  const open = useBench((s) => s.open)
  return open ? (
    <Suspense fallback={null}>
      <BenchModal />
    </Suspense>
  ) : null
}

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
      <RealmHud />
      <MapControls />
      <MapHint />
      <HoverTag />
      <Timeline />
      <RightPanel />
      <GodPanel />
      <Toasts />
      <ResetVeil />
      <LazySettings />
      <LazyBench />
      <LiveAnnouncer />
      <Loader />
    </div>
  )
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (useTown.getState().settingsOpen || useBench.getState().open) return
      if (e.key === 'Escape') town.select(null)
      if (e.key === '+' || e.key === '=') town.zoomBy(1.25)
      if (e.key === '-') town.zoomBy(0.8)
      if (e.key === '0') town.fit()
      if (e.key === 'g' || e.key === 'G') useTown.getState().setGodOpen(!useTown.getState().godOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
