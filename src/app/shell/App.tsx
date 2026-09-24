import { lazy, Suspense, useEffect } from 'react'
import { useTown } from '../store'
import { useBench } from '../features/bench/benchStore'
import { town } from '../town'
import { useLayoutVars } from './layout'
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
import { EndScreen } from '../features/realm/EndScreen'
import { ChronicleModal } from '../features/chronicle/ChronicleModal'
import { ActivityModal } from '../features/activity/ActivityModal'
import { KeyGate } from './KeyGate'
import { ThronePanel } from '../features/throne/ThronePanel'
import { MailboxModal } from '../features/throne/MailboxModal'
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

const relayout = () => town.relayout()

/** For keyboard users: straight to writing an announcement, past the map and the top bar. */
function SkipLink() {
  const go = () => {
    useTown.getState().setPanelOpen(true)
    window.setTimeout(() => document.getElementById('announcement')?.focus(), 50)
  }
  return (
    <button className="skip-link" onClick={go}>
      Ir a escribir un pregón
    </button>
  )
}

export function App() {
  useKeyboardShortcuts()
  useLayoutVars(relayout)
  useEffect(() => {
    document.title = `AI Town · ${town.content.name}`
  }, [])
  return (
    <div className="app">
      <SkipLink />
      <main aria-label="Mapa del pueblo">
        <TownCanvas />
        <MapControls />
        <MapHint />
        <HoverTag />
      </main>
      <TopBar />
      <RealmHud />
      <Timeline />
      <div className="right-column">
        <GodPanel />
        <ThronePanel />
        <RightPanel />
      </div>
      <EndScreen />
      <ChronicleModal />
      <MailboxModal />
      <ActivityModal />
      <KeyGate />
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
      if (useTown.getState().settingsOpen || useTown.getState().chronicleOpen || useTown.getState().activityOpen || useBench.getState().open) return
      if (e.key === 'Escape') town.select(null)
      if (e.key === '+' || e.key === '=') town.zoomBy(1.25)
      if (e.key === '-') town.zoomBy(0.8)
      if (e.key === '0') town.fit()
      if (e.key === 'g' || e.key === 'G') useTown.getState().setGodOpen(!useTown.getState().godOpen)
      if (e.key === 't' || e.key === 'T') useTown.getState().setThroneOpen(!useTown.getState().throneOpen)
      if (e.key === 'b' || e.key === 'B') useTown.setState({ activityOpen: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
