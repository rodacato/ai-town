import { DecisionScheduler } from '../core/decisions/scheduler'
import { detectPlace, type Announcement } from '../core/reactions/announcement'
import { ReactionEngine, type LogEntry, type Reaction } from '../core/reactions/engine'
import { eventAt, react, type OutcomeVisual } from '../core/reactions/outcome'
import { isNight } from '../core/sim/rhythm'
import type { Season } from '../core/sim/season'
import type { Weather } from '../core/sim/weather'
import { Simulation } from '../core/sim/simulation'
import { createProvider } from '../providers'
import { keyRing, saveSettings, withKeys, type LlmSettings } from '../providers/llm/config'
import { forgetKeys, openKeys, sealKeys } from '../providers/llm/vault'
import { TownRenderer } from '../render/TownRenderer'
import { activeWorld } from '../worlds'
import { useTown } from './store'
import { EMPTY_DRAFT } from './store/composer'
import { HAD_PLAINTEXT_KEYS } from './store/settings'

export const LAYOUT = { panelWidth: 380, gutter: 24, timelineHeight: 92 }
const MAP_INSETS = { right: LAYOUT.panelWidth + LAYOUT.gutter + 16, bottom: LAYOUT.timelineHeight + LAYOUT.gutter + 12 }
const REASONING_FLUSH_MS = 120
const LOG_LIMIT = 400
/** Tiles within which people see an event happen with their own eyes. */
const SIGHT_RADIUS = 10

/** The one place the UI goes through to change the town: it owns the simulation, the engine and the map. */
class TownController {
  readonly world = activeWorld
  readonly content = activeWorld.content
  readonly sim = new Simulation(activeWorld.content)
  readonly engine: ReactionEngine
  private renderer: TownRenderer | null = null
  private toastedFor = new Set<string>()
  private snapshotFrame = 0
  private reasoningTimer = 0
  private pendingLog: LogEntry[] = []

  constructor() {
    const { provider, concurrency, timeoutMs } = createProvider(useTown.getState().llm, this.content)
    this.engine = new ReactionEngine(this.sim, new DecisionScheduler(provider, concurrency, timeoutMs))
    this.engine.on((e) => {
      if (e.type === 'reasoning') return this.scheduleReasoning()
      if (e.type === 'log') this.pendingLog.push(e.entry)
      if (e.type === 'outcome') {
        useTown.setState({ outcome: e.outcome })
        useTown.getState().toast(e.outcome.summary)
      }
      if (e.type === 'complete' && this.engine.announcement && !this.toastedFor.has(this.engine.announcement.id)) {
        this.toastedFor.add(this.engine.announcement.id)
        useTown.getState().toast('Todo el pueblo ha decidido.')
      }
      this.scheduleSnapshot()
    })
  }

  /** Creates the map inside `host`; the returned function tears it down. */
  mount(host: HTMLElement) {
    let disposed = false
    TownRenderer.create(host, this.sim, this.engine, this.world.art, {
      onHover: (hoveredId) => useTown.setState({ hoveredId }),
      onSelect: (selectedId) => useTown.setState({ selectedId }),
    }, { insets: () => MAP_INSETS }).then((r) => {
      if (disposed) return r.destroy()
      this.renderer = r
      r.camera.onInteract = () => useTown.getState().interacted || useTown.setState({ interacted: true })
      useTown.setState({ ready: true })
    })
    this.syncClock()
    if (HAD_PLAINTEXT_KEYS) {
      saveSettings(useTown.getState().llm)
      useTown.getState().toast('Por seguridad, tus keys ya no se guardan sin cifrar. Siguen activas en esta pestaña.')
    }
    const clock = window.setInterval(() => this.syncClock(), 1000)
    return () => {
      disposed = true
      window.clearInterval(clock)
      this.renderer?.destroy()
      this.renderer = null
      useTown.setState({ ready: false })
    }
  }

  select(id: string | null) {
    this.renderer?.select(id)
  }

  highlight(id: string | null) {
    this.renderer?.highlight(id)
  }

  zoomBy(factor: number) {
    this.renderer?.camera.zoomBy(factor)
  }

  fit() {
    this.renderer?.camera.fit()
  }

  residentScreenPosition(id: string) {
    return this.renderer?.residentScreenPosition(id) ?? null
  }

  detectPlace(text: string) {
    return detectPlace(text, this.sim.world.places, this.content.homeKeywords)
  }

  /** Previews the place an unsent draft mentions. */
  previewPlace(text: string) {
    this.renderer?.markPlace(this.detectPlace(text))
  }

  transmit() {
    const { draft } = useTown.getState()
    const text = draft.text.trim()
    if (text.length < 3) return
    const truth = draft.truth === 'random' ? Math.random() < 0.5 : draft.truth === 'true'
    this.begin({ id: crypto.randomUUID(), text, speaker: draft.speaker, place: this.detectPlace(text), minutes: Math.floor(this.sim.minutes), truth })
  }

  private begin(announcement: Announcement, fit = true) {
    this.renderer?.markPlace(announcement.place)
    this.renderer?.select(null)
    if (fit) this.renderer?.camera.fit()
    this.pendingLog = []
    useTown.setState({ announcement, complete: false, reasoning: {}, log: [], startedAt: performance.now(), interacted: true, outcome: null })
    this.engine.start(announcement)
  }

  reset() {
    if (useTown.getState().resetting) return
    useTown.setState({ resetting: true })
    window.setTimeout(() => {
      this.engine.stop()
      this.sim.reset()
      this.renderer?.showEvent(null)
      this.renderer?.setSpeed(1)
      this.renderer?.select(null)
      this.renderer?.markPlace(null)
      this.renderer?.camera.fit(false)
      this.pendingLog = []
      useTown.setState({ announcement: null, reactions: {}, reasoning: {}, log: [], complete: false, draft: EMPTY_DRAFT, outcome: null, godEvent: null, weather: 'clear', season: 'summer', speed: 1, curfew: false })
      this.syncClock()
      window.setTimeout(() => {
        useTown.setState({ resetting: false })
        useTown.getState().toast('Pueblo reiniciado. Todos vuelven a su rutina.')
      }, 120)
    }, 320)
  }

  retry(ids: string[]) {
    for (const id of ids) this.engine.retry(id)
  }

  applySettings(llm: LlmSettings) {
    const { provider, concurrency, timeoutMs } = createProvider(llm, this.content)
    this.engine.scheduler.provider = provider
    this.engine.scheduler.timeoutMs = timeoutMs
    this.engine.scheduler.setConcurrency(concurrency)
    saveSettings(llm)
    useTown.setState({ llm })
  }

  /** Keeps the current keys encrypted with a passphrase so they survive reloads. */
  async rememberKeys(passphrase: string) {
    await sealKeys(keyRing(useTown.getState().llm), passphrase)
    useTown.setState({ vaultLocked: false })
  }

  async unlockKeys(passphrase: string) {
    const keys = await openKeys(passphrase)
    this.applySettings(withKeys(useTown.getState().llm, keys))
    useTown.setState({ vaultLocked: false })
  }

  forgetRememberedKeys() {
    forgetKeys()
    useTown.setState({ vaultLocked: false })
  }

  // God panel: direct control over the town, for trying things out without waiting.

  setHour(hour: number) {
    this.sim.setHour(hour)
    this.syncClock()
  }

  setSpeed(speed: number) {
    useTown.setState({ speed })
    this.renderer?.setSpeed(speed)
  }

  setWeather(weather: Weather) {
    this.sim.weather = weather
    useTown.setState({ weather })
  }

  setSeason(season: Season) {
    this.sim.season = season
    useTown.setState({ season })
  }

  /** Makes something happen. Whoever sees it decides what to do and may spread the word; mid-announcement it only scares or draws people nearby. */
  unleash(visual: OutcomeVisual, placeId: string) {
    const event = eventAt(this.content, this.sim.world.places, visual, placeId)
    this.renderer?.showEvent(event)
    useTown.setState({ godEvent: event })
    useTown.getState().toast(event.summary)
    const busy = this.engine.active && !this.engine.settled
    if (busy) return react(this.sim, event, (r) => r.frozen || r.tasks.length > 0)
    this.begin(
      {
        id: crypto.randomUUID(),
        text: event.sighting ?? event.summary,
        speaker: { kind: 'sight' },
        place: event.place,
        minutes: Math.floor(this.sim.minutes),
        origin: event.at,
        reach: SIGHT_RADIUS,
      },
      false,
    )
  }

  /** Something unexpected, favouring the eerie after dark. */
  unleashRandom() {
    const night = isNight(this.sim.minutes)
    const pool: [OutcomeVisual, string, number][] = [
      ['fire', 'forest', 1],
      ['monster', 'bridge', 1],
      ['undead', 'cemetery', night ? 4 : 0.3],
      ['wolves', 'forest', night ? 3 : 1],
      ['ghost', 'crypt', night ? 3 : 0.3],
      ['blaze', 'tavern', 1],
      ['flood', 'riverbank', this.sim.weather === 'storm' || this.sim.weather === 'rain' ? 3 : 0.5],
      ['meteor', 'field', 0.6],
      ['thief', 'market', night ? 0.5 : 1.5],
      ['caravan', 'gate', night ? 0.2 : 1.5],
      ['feast', 'plaza', night ? 0.3 : 1],
      ['treasure', 'crypt', 0.5],
    ]
    const total = pool.reduce((n, [, , w]) => n + w, 0)
    let r = Math.random() * total
    const [visual, place] = pool.find(([, , w]) => (r -= w) < 0) ?? pool[0]
    this.unleash(visual, place)
  }

  clearEvent() {
    this.renderer?.showEvent(null)
    useTown.setState({ godEvent: null })
  }

  gather(placeId: string) {
    for (const r of this.sim.residents) {
      if (r.frozen) continue
      const spot = this.sim.spotAt(placeId)
      if (spot) this.sim.assign(r, [{ kind: 'walk', to: spot, label: 'Convocado por una fuerza misteriosa' }, { kind: 'wait', seconds: 25, label: 'Esperando a ver qué pasa' }])
    }
    useTown.setState({ curfew: false })
  }

  setCurfew(on: boolean) {
    for (const r of this.sim.residents) if (!r.frozen) this.sim.assign(r, on ? [{ kind: 'enterHome', label: 'Toque de queda' }] : [])
    useTown.setState({ curfew: on })
  }

  /** One of the example announcements, with its truth left to chance. */
  surprise() {
    const ex = this.content.examples[Math.floor(Math.random() * this.content.examples.length)]
    useTown.getState().setDraft({ text: ex.text, speaker: ex.speaker, truth: 'random' })
    this.transmit()
  }

  private syncClock() {
    useTown.setState({ minutes: Math.floor(this.sim.minutes), outside: this.sim.residents.filter((r) => r.mode !== 'inside').length })
  }

  private scheduleSnapshot() {
    if (this.snapshotFrame) return
    this.snapshotFrame = requestAnimationFrame(() => {
      this.snapshotFrame = 0
      const reactions: Record<string, Reaction> = {}
      for (const [id, r] of this.engine.reactions) reactions[id] = { ...r, rumors: [...r.rumors], told: [...r.told], calls: [...r.calls] }
      const log = this.pendingLog.length ? [...useTown.getState().log, ...this.pendingLog.splice(0)].slice(-LOG_LIMIT) : useTown.getState().log
      useTown.setState({ reactions, complete: this.engine.settled, log })
      this.flushReasoning()
    })
  }

  private scheduleReasoning() {
    if (this.reasoningTimer) return
    this.reasoningTimer = window.setTimeout(() => this.flushReasoning(), REASONING_FLUSH_MS)
  }

  private flushReasoning() {
    window.clearTimeout(this.reasoningTimer)
    this.reasoningTimer = 0
    const reasoning: Record<string, string> = {}
    for (const [id, r] of this.engine.reactions) if (r.reasoning) reasoning[id] = r.reasoning
    useTown.setState({ reasoning })
  }
}

export const town = new TownController()
