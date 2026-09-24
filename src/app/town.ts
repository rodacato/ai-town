import { DecisionScheduler } from '../core/decisions/scheduler'
import { detectPlace, type Announcement } from '../core/reactions/announcement'
import { ReactionEngine, type LogEntry, type Reaction } from '../core/reactions/engine'
import { eventAt, react, type OutcomeVisual } from '../core/reactions/outcome'
import { isNight } from '../core/sim/rhythm'
import { alive, averageMood, foodDays, type Ledger } from '../core/economy/economy'
import { Chronicle, type ChronicleKind } from '../core/realm/chronicle'
import type { Activity, ActivityKind } from './store/reign'
import { SEASON_DAYS, seasonOfDay } from '../core/realm/terrarium'
import { FRESH_REIGN, newSeed, type ReignState } from './store/reign'
import { SEASONS, SEASON_TEXT, type Season } from '../core/sim/season'
import type { Weather } from '../core/sim/weather'
import { Simulation } from '../core/sim/simulation'
import { createProvider } from '../providers'
import { activeLabel, saveSettings, withKeys, type LlmSettings } from '../providers/llm/config'
import { ACTION_META } from '../theme/actions'
import * as keys from './keys'
import { transportInfo } from '../providers/llm/client'
import { TownRenderer } from '../render/TownRenderer'
import { activeWorld } from '../worlds'
import { useTown } from './store'
import { EMPTY_DRAFT } from './store/composer'
import { HAD_PLAINTEXT_KEYS } from './store/settings'
import { loadMemory, saveMemory } from './memoryStorage'
import { exportGame, forgetTown, importGame, restoreTown, saveTown } from './townState'
import { speakerName } from '../core/reactions/announcement'
import { firstName, nameOf } from '../core/lang'
import type { Outcome } from '../core/reactions/outcome'
import type { MemoryEntry } from '../core/memory/memory'
import { Terrarium, type TerrariumHost } from './terrarium'
import { DIFFICULTY, withDifficulty, type Difficulty } from '../core/realm/difficulty'
import { Throne, type ThroneHost } from './throne'
import { roundSummary } from '../core/reactions/round'
import { clip } from '../core/format'

export const LAYOUT = { panelWidth: 440, gutter: 24, timelineHeight: 92 }
const MAP_INSETS = { right: LAYOUT.panelWidth + LAYOUT.gutter + 16, bottom: LAYOUT.timelineHeight + LAYOUT.gutter + 12 }
const REASONING_FLUSH_MS = 120
const LOG_LIMIT = 400
/** Tiles within which people see an event happen with their own eyes. */
const SIGHT_RADIUS = 10
const REALM_KINDS: ChronicleKind[] = ['dawn', 'decree', 'plot', 'end']
/** Game minutes per second in the terrarium: a day in about a minute and a half. */
const TERRARIUM_SPEED = 16

/** The one place the UI goes through to change the town: it owns the simulation, the engine and the map. */
class TownController implements TerrariumHost, ThroneHost {
  readonly world = activeWorld
  readonly content = activeWorld.content
  readonly sim = new Simulation(activeWorld.content)
  readonly engine: ReactionEngine
  readonly memory = loadMemory(activeWorld.content.id)
  readonly chronicle = new Chronicle()
  private remembered = new Set<string>()
  /** Bumped by each new game, so a model call from the old one does not land in the new one. */
  private gen = 0
  private renderer: TownRenderer | null = null
  readonly terrarium = new Terrarium(this)
  readonly throne = new Throne(this)
  private toastedFor = new Set<string>()
  private snapshotFrame = 0
  private reasoningTimer = 0
  private pendingLog: LogEntry[] = []
  private activitySeq = Date.now()
  /** The log line of the announcement the residents are deciding on. */
  private deciding: number | null = null
  /** A saved game is being loaded: nothing may overwrite it before the page restarts. */
  private loading = false

  constructor() {
    const { provider, concurrency, timeoutMs } = createProvider(useTown.getState().llm, this.content)
    this.engine = new ReactionEngine(this.sim, new DecisionScheduler(provider, concurrency, timeoutMs))
    const restored = restoreTown(this.content.id, this.sim)
    if (restored) {
      this.chronicle.entries = restored.chronicle
      const reign = restored.reign ? { ...FRESH_REIGN, ...restored.reign, standing: { ...FRESH_REIGN.standing, ...restored.reign.standing } } : null
      // Calls cut short by the reload will never report back.
      if (reign) reign.activity = reign.activity.map((a) => (a.status === 'pending' ? { ...a, status: 'error' as const, detail: 'Se interrumpió al recargar la página.' } : a))
      this.throne.queue = reign?.queued ?? []
      useTown.setState({ chronicle: restored.chronicle.slice(-80), ...(reign ?? {}), ...(reign ? { speed: reign.speed } : {}) })
      useTown.setState({ weather: this.sim.weather, season: this.sim.season })
      if (this.content.economy) this.sim.useEconomyRules(withDifficulty(this.content.economy, useTown.getState().difficulty), false)
    } else this.freshStart()
    if (useTown.getState().autoplay) this.applyProvider()
    void transportInfo().then(({ envKeys }) => useTown.setState({ envKeys, keysChecked: true }))
    this.sim.onLedger((l) => this.onLedger(l))
    this.sim.seasonAt = (day) => this.seasonAt(day)
    this.engine.memory = this.memory
    useTown.setState({ memoryEntries: [...this.memory.entries] })
    this.syncRealm()
    this.engine.on((e) => {
      if (e.type === 'reasoning') return this.scheduleReasoning()
      if (e.type === 'log') this.pendingLog.push(e.entry)
      if (e.type === 'outcome') {
        useTown.setState({ outcome: e.outcome })
        useTown.getState().toast(e.outcome.summary)
        this.remember(e.outcome)
        if (e.outcome.truth) this.terrarium.beginEvent(e.outcome.visual, e.outcome.summary)
      }
      if (e.type === 'complete') this.settleDecisions()
      if (e.type === 'complete' && this.engine.announcement?.speaker.kind === 'sight') this.remember(useTown.getState().godEvent)
      if (e.type === 'outcome' || (e.type === 'complete' && this.engine.announcement?.truth === undefined)) window.setTimeout(() => this.throne.flushProclamations(), 4000)
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
      this.setSpeed(useTown.getState().autoplay ? TERRARIUM_SPEED : useTown.getState().speed)
      r.camera.onInteract = () => useTown.getState().interacted || useTown.setState({ interacted: true })
      useTown.setState({ ready: true })
    })
    this.syncClock()
    if (HAD_PLAINTEXT_KEYS) {
      saveSettings(useTown.getState().llm)
      useTown.getState().toast('Tus keys estaban guardadas sin cifrar y ya las quité. Siguen activas en esta pestaña: guárdalas cifradas en Configuración para no perderlas al recargar.')
    }
    const clock = window.setInterval(() => {
      this.syncClock()
      this.terrarium.tick()
    }, 1000)
    const save = () => this.save()
    const autosave = window.setInterval(save, 5000)
    window.addEventListener('pagehide', save)
    return () => {
      disposed = true
      save()
      window.clearInterval(clock)
      window.clearInterval(autosave)
      window.removeEventListener('pagehide', save)
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
    if (this.deciding !== null) this.settleDecisions()
    this.engine.start(announcement)
    const said = clip(announcement.text, 90)
    const via = this.residentsVia()
    this.deciding = this.track('residents', `${announcement.speaker.kind === 'sight' ? 'Lo vieron' : 'Pregón'}: «${said}»`, { status: 'pending', via, detail: `Los vecinos deciden qué hacer${via === 'reglas' ? ' con reglas' : ` con ${via}`}…` })
  }

  /** How the residents' round of decisions went, for the log. */
  private settleDecisions() {
    if (this.deciding === null) return
    const r = roundSummary([...this.engine.reactions.values()])
    const actions = r.actions.map(([action, n]) => `${n} ${ACTION_META[action].label.toLowerCase()}`).join(', ')
    this.settle(this.deciding, {
      status: r.errors && !r.decided ? 'error' : 'ok',
      detail: `${r.decided} de ${r.total} decidieron${actions ? `: ${actions}` : ''}${r.errors ? ` · ${r.errors} con error` : ''}${r.calls ? ` · ${r.calls} consultas` : ''}`,
      ms: r.medianMs,
      costUsd: r.costUsd,
      costEstimated: r.costEstimated,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
    })
    this.deciding = null
  }

  reset(difficulty: Difficulty = 'normal') {
    if (useTown.getState().resetting) return
    useTown.setState({ resetting: true })
    window.setTimeout(() => {
      this.engine.stop()
      this.sim.reset()
      forgetTown(this.content.id)
      this.forgetMemory()
      this.chronicle.clear()
      this.throne.queue = []
      this.terrarium.reset()
      this.gen++
      this.deciding = null
      useTown.setState({ ...FRESH_REIGN, rulerMode: useTown.getState().rulerMode, residentsOnModel: useTown.getState().residentsOnModel })
      this.applyProvider()
      this.syncRealm()
      this.renderer?.showEvent(null)
      this.renderer?.select(null)
      this.renderer?.markPlace(null)
      this.renderer?.camera.fit(false)
      this.pendingLog = []
      useTown.setState({ announcement: null, reactions: {}, reasoning: {}, log: [], complete: false, draft: EMPTY_DRAFT, outcome: null, godEvent: null, weather: 'clear', chronicle: [] })
      this.freshStart(difficulty)
      this.syncClock()
      window.setTimeout(() => {
        useTown.setState({ resetting: false })
        useTown.getState().toast(`Partida nueva, dificultad ${DIFFICULTY[difficulty].label.toLowerCase()}: el pueblo empieza de cero y sin memoria.`)
      }, 120)
    }, 320)
  }

  /** A new game: its own calendar of fate, a season picked at random, Monday morning, at double speed. */
  private freshStart(difficulty: Difficulty = 'normal') {
    const seasonStart = Math.floor(Math.random() * 4)
    useTown.setState({ seed: newSeed(), seasonStart, difficulty })
    if (this.content.economy) this.sim.useEconomyRules(withDifficulty(this.content.economy, difficulty), true)
    this.syncRealm()
    this.setSeason(SEASONS[seasonStart])
    this.setSpeed(2)
  }

  /** Seasons follow the calendar; a season picked by hand in the god panel lasts until the next change. */
  private seasonAt(day: number): Season | null {
    const start = useTown.getState().seasonStart
    const today = seasonOfDay(day, SEASON_DAYS, start)
    return day > 0 && today !== seasonOfDay(day - 1, SEASON_DAYS, start) ? today : null
  }

  /** The simulation already turned the season before the harvest; the interface and the chronicle catch up. */
  private announceSeason() {
    const season = this.sim.season
    if (season === useTown.getState().season) return
    useTown.setState({ season })
    const line = `Cambia la estación: ${SEASON_TEXT[season].label.toLowerCase()}.`
    useTown.getState().toast(line)
    this.log('dawn', line)
  }

  retry(ids: string[]) {
    for (const id of ids) this.engine.retry(id)
  }

  applySettings(llm: LlmSettings) {
    saveSettings(llm)
    useTown.setState({ llm })
    this.applyProvider()
    void keys.resealKeys(llm)
  }

  /** Residents decide with the chosen model, except in the terrarium, where they use rules unless told otherwise. */
  private applyProvider() {
    const { llm, autoplay, residentsOnModel } = useTown.getState()
    const { provider, concurrency, timeoutMs } = createProvider(autoplay && !residentsOnModel ? { ...llm, active: 'mock' } : llm, this.content)
    this.engine.scheduler.provider = provider
    this.engine.scheduler.timeoutMs = timeoutMs
    this.engine.scheduler.setConcurrency(concurrency)
  }

  // Terrarium: the town runs itself while the user watches as fate and the Baroness rules.

  setAutoplay(autoplay: boolean) {
    const state = useTown.getState()
    if (autoplay && state.standing.end) return state.toast('Esta partida ya terminó. Empieza una nueva para poner en marcha el terrario.')
    useTown.setState({ autoplay })
    if (autoplay && state.rulerMode === 'manual') {
      this.throne.setRulerMode('rules')
      state.toast('La Baronesa gobernará sola (con reglas); en el Trono puedes darle un modelo.')
    }
    this.applyProvider()
    this.setSpeed(autoplay ? TERRARIUM_SPEED : 2)
  }

  setResidentsOnModel(residentsOnModel: boolean) {
    useTown.setState({ residentsOnModel })
    this.applyProvider()
  }

  /** Keeps the current keys encrypted with a passphrase so they survive reloads. */
  async rememberKeys(passphrase: string) {
    await keys.rememberKeys(useTown.getState().llm, passphrase)
    useTown.setState({ vaultLocked: false, vaultOpen: true })
  }

  async unlockKeys(passphrase: string) {
    const ring = await keys.unlockKeys(passphrase)
    this.applySettings(withKeys(useTown.getState().llm, ring))
    useTown.setState({ vaultLocked: false, vaultOpen: true })
  }

  forgetRememberedKeys() {
    keys.forgetRememberedKeys()
    useTown.setState({ vaultLocked: false, vaultOpen: false })
  }

  /** Dawn: the day's accounts in one line, and who is gone. */
  private onLedger(l: Ledger) {
    const { toast } = useTown.getState()
    const name = (id: string) => nameOf(this.content, id)
    const dawn = `Amanece el día ${l.day + 1}: cosecha +${l.harvest}, ${l.sold} raciones vendidas${l.unfed.length ? `, ${l.unfed.length} sin comer` : ''}.`
    toast(dawn)
    const e = this.sim.economy!
    const sales = l.sold * Math.ceil(e.foodPrice * (e.laws.rationing ? 0.5 : 1))
    const food = `🍞 +${l.harvest} cosecha, −${e.laws.rationing ? l.sold / 2 : l.sold} comidas → ${Math.floor(e.granary)}`
    const gold = `💰 +${l.taxes} impuestos, +${sales} raciones, −${l.wages} guardia${l.unpaid ? ` (faltaron ${l.unpaid})` : ''} → ${e.treasury}`
    this.log('dawn', dawn, `${food}. ${gold}.`)
    for (const id of l.died) {
      const line = `${name(id)} murió de hambre. Hay una tumba nueva en el cementerio.`
      this.log('death', line)
      window.setTimeout(() => toast(line), 1500)
    }
    for (const id of l.left) {
      const line = `${name(id)} no aguantó más y se marcha del pueblo.`
      this.log('leave', line)
      window.setTimeout(() => toast(line), 1500)
    }
    this.throne.settleStanding(l.day)
    this.announceSeason()
    this.recordDay(l.day)
    this.syncRealm()
    if (useTown.getState().standing.end && useTown.getState().autoplay) {
      useTown.setState({ autoplay: false })
      this.applyProvider()
      this.setSpeed(0)
    }
    if (!useTown.getState().standing.end || useTown.getState().endSeen) void this.throne.reign()
  }

  private recordDay(day: number) {
    const e = this.sim.economy!
    const ids = Object.keys(e.needs)
    const { honesty, history } = useTown.getState()
    const row = {
      day,
      season: this.sim.season,
      population: ids.filter((id) => alive(e, id)).length,
      treasury: e.treasury,
      granary: Math.floor(e.granary),
      mood: averageMood(e),
      trust: this.memory.reputation({ kind: 'authority' }).trust,
      actions: 0,
      lies: honesty.lies,
      problems: 0,
    }
    useTown.setState({ history: [...history.filter((h) => h.day !== day), row].slice(-200) })
  }

  save() {
    if (this.loading) return
    saveTown(this.content.id, this.sim, this.chronicle.entries, this.reignState())
    saveMemory(this.content.id, this.memory)
  }

  /** The game as a file to keep or share. */
  exportGame() {
    this.save()
    const day = (this.sim.economy?.day ?? 0) + 1
    return { name: `chismeroble-dia-${day}.json`, text: exportGame(this.content.id) }
  }

  /** Loads a saved game: stored first, then the page restarts from it. */
  importGame(text: string) {
    const problem = importGame(this.content.id, text)
    if (problem) return useTown.getState().toast(problem)
    this.loading = true
    window.location.reload()
  }

  log(kind: ChronicleKind, text: string, detail?: string) {
    const line = text.charAt(0).toUpperCase() + text.slice(1)
    this.chronicle.add(this.sim.minutes, kind, line)
    useTown.setState({ chronicle: this.chronicle.entries.slice(-80) })
    if (kind !== 'ruler') this.track(REALM_KINDS.includes(kind) ? 'realm' : 'town', line, { detail })
  }

  get generation() {
    return this.gen
  }

  proclaim(a: Announcement) {
    this.begin(a)
  }

  /** The residents are still reacting to something. */
  busy() {
    return this.engine.active && !this.engine.settled
  }

  showThought(id: string, emoji: string, text: string) {
    this.renderer?.muse(id, emoji, text)
  }

  rememberDeed(deed: MemoryEntry) {
    this.memory.record(deed)
    saveMemory(this.content.id, this.memory)
    useTown.setState({ memoryEntries: [...this.memory.entries] })
  }

  /** Adds a line to the log; returns its id so a model call can report back when it finishes. */
  track(kind: ActivityKind, title: string, extra: Partial<Activity> = {}) {
    const id = ++this.activitySeq
    useTown.setState((s) => ({ activity: [...s.activity, { id, at: Date.now(), minutes: Math.floor(this.sim.minutes), kind, title, status: 'info' as const, ...extra }].slice(-250) }))
    return id
  }

  settle(id: number, patch: Partial<Activity>) {
    useTown.setState((s) => ({ activity: s.activity.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  }

  /** Who the residents think with right now. */
  residentsVia() {
    const { autoplay, residentsOnModel, llm } = useTown.getState()
    return llm.active === 'mock' || (autoplay && !residentsOnModel) ? 'reglas' : activeLabel(llm)
  }

  /** Everything of the reign worth saving: whatever FRESH_REIGN lists, so a new field is saved without touching this. */
  private reignState(): ReignState {
    const s = useTown.getState()
    const saved = Object.fromEntries(Object.keys(FRESH_REIGN).map((k) => [k, s[k as keyof ReignState]])) as unknown as ReignState
    return { ...saved, activity: s.activity.slice(-150), queued: this.throne.queue }
  }

  syncRealm() {
    const e = this.sim.economy
    if (!e) return
    const people = Object.fromEntries(
      Object.entries(e.needs).map(([id, n]) => [id, { status: n.status, daysHungry: n.daysHungry, health: n.health, mood: n.mood, coins: e.purses[id] ?? 0 }]),
    )
    const ids = Object.keys(e.needs)
    useTown.setState({
      realm: {
        day: e.day,
        treasury: e.treasury,
        granary: e.granary,
        foodDays: foodDays(e),
        mood: averageMood(e),
        taxRate: e.taxRate,
        foodPrice: e.foodPrice,
        hungry: ids.filter((id) => e.needs[id].status === 'hungry' || e.needs[id].status === 'sick').length,
        gone: ids.filter((id) => e.needs[id].status === 'gone'),
        dead: ids.filter((id) => e.needs[id].status === 'dead'),
        people,
      },
    })
  }

  /** Records a revealed announcement or a sighting, and tells how the speaker's standing moved. */
  private remember(outcome: Outcome | null) {
    const a = this.engine.announcement
    if (!a || !outcome || this.remembered.has(a.id)) return
    this.remembered.add(a.id)
    const decided = [...this.engine.reactions.values()].filter((r) => r.decision && !r.isSpeaker)
    const sight = a.speaker.kind === 'sight'
    const before = this.memory.reputation(a.speaker)
    const said = a.text.length > 70 ? `${a.text.slice(0, 67)}…` : a.text
    this.memory.record({
      id: a.id,
      minutes: a.minutes,
      text: a.text,
      speaker: a.speaker,
      truth: outcome.truth,
      summary: sight ? outcome.summary.replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase()) : `${this.speakerShort(a.speaker)} anunció «${said}» y ${outcome.truth ? 'era verdad' : 'era mentira'}`,
      believers: decided.filter((r) => r.decision!.believes).map((r) => r.id),
      doubters: decided.filter((r) => !r.decision!.believes).map((r) => r.id),
      told: [...this.engine.reactions.values()].flatMap((r) => r.told.map((to) => ({ from: r.id, to }))),
    })
    saveMemory(this.content.id, this.memory)
    useTown.setState({ memoryEntries: [...this.memory.entries] })
    this.log(sight ? 'event' : 'reveal', `${this.memory.entries.at(-1)!.summary}.`)
    if (sight) return
    const after = this.memory.reputation(a.speaker)
    const pct = (x: number) => `${Math.round(x * 100)}%`
    window.setTimeout(() => useTown.getState().toast(`${this.speakerShort(a.speaker)} ${after.trust >= before.trust ? 'gana' : 'pierde'} confianza: ${pct(before.trust)} → ${pct(after.trust)}`), 1800)
  }

  /** "la Baronesa", "el forastero", "Kael": how the town names a speaker in passing. */
  speakerShort(s: Announcement['speaker']) {
    if (s.kind === 'neighbor') return firstName(speakerName(this.content, s).split(',')[0])
    return this.content.speakers[s.kind].label
  }

  /** Ends the announcement on screen, so another can be made; the game goes on. */
  closeAnnouncement() {
    if (this.deciding !== null) this.settleDecisions()
    this.engine.stop()
    this.renderer?.markPlace(null)
    this.pendingLog = []
    useTown.setState({ announcement: null, reactions: {}, reasoning: {}, log: [], complete: false, outcome: null, draft: EMPTY_DRAFT })
    this.throne.flushProclamations()
  }

  forgetMemory() {
    this.memory.clear()
    this.remembered.clear()
    saveMemory(this.content.id, this.memory)
    useTown.setState({ memoryEntries: [] })
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
    this.terrarium.beginEvent(visual, event.summary)
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
  }


  /** One of the example announcements, with its truth left to chance. */
  surprise() {
    const ex = this.content.examples[Math.floor(Math.random() * this.content.examples.length)]
    useTown.getState().setDraft({ text: ex.text, speaker: ex.speaker, truth: 'random' })
    this.transmit()
  }

  private syncClock() {
    useTown.setState({ minutes: Math.floor(this.sim.minutes), outside: this.sim.residents.filter((r) => r.mode === 'walking' || r.mode === 'idle').length })
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
