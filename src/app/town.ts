import { DecisionScheduler } from '../core/decisions/scheduler'
import { detectPlace, type Announcement } from '../core/reactions/announcement'
import { ReactionEngine, type LogEntry, type Reaction } from '../core/reactions/engine'
import { eventAt, react, type OutcomeVisual } from '../core/reactions/outcome'
import { isNight } from '../core/sim/rhythm'
import { alive, averageMood, foodDays, type Ledger } from '../core/economy/economy'
import { applyImpact } from '../core/economy/impact'
import { Chronicle, type ChronicleKind } from '../core/realm/chronicle'
import { enact, type Decree, type DecreeResult } from '../core/realm/decrees'
import { buildReport, reportText } from '../core/realm/report'
import type { RulerAction } from '../core/realm/ruler'
import { createModelRuler, createRulesRuler } from '../providers/ruler'
import { dawnStanding, GOALS } from '../core/realm/standing'
import { rulesMusing, type MusingInput } from '../core/realm/musing'
import { modelMusing } from '../providers/musing'
import type { Activity, ActivityKind } from './store/reign'
import { fateCalendar } from '../core/realm/reign'
import { SEASON_DAYS, seasonOfDay } from '../core/realm/terrarium'
import { newSeed } from './store/reign'
import { FRESH_REIGN, type ReignState, type RulerLog, type RulerMode } from './store/reign'
import { SEASONS, SEASON_TEXT, type Season } from '../core/sim/season'
import type { Weather } from '../core/sim/weather'
import { Simulation } from '../core/sim/simulation'
import { createProvider } from '../providers'
import { activeLabel, keyRing, saveSettings, withKeys, type LlmSettings } from '../providers/llm/config'
import { ACTION_META } from '../theme/actions'
import { forgetKeys, openKeys, sealKeys } from '../providers/llm/vault'
import { TownRenderer } from '../render/TownRenderer'
import { activeWorld } from '../worlds'
import { useTown } from './store'
import { EMPTY_DRAFT } from './store/composer'
import { HAD_PLAINTEXT_KEYS } from './store/settings'
import { loadMemory, saveMemory } from './memoryStorage'
import { exportGame, forgetTown, importGame, restoreTown, saveTown } from './townState'
import { speakerName } from '../core/reactions/announcement'
import { firstName } from '../core/lang'
import type { Outcome } from '../core/reactions/outcome'

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
class TownController {
  readonly world = activeWorld
  readonly content = activeWorld.content
  readonly sim = new Simulation(activeWorld.content)
  readonly engine: ReactionEngine
  readonly memory = loadMemory(activeWorld.content.id)
  readonly chronicle = new Chronicle()
  private remembered = new Set<string>()
  private pendingProclamations: { text: string; honest: boolean }[] = []
  private renderer: TownRenderer | null = null
  private toastedFor = new Set<string>()
  private snapshotFrame = 0
  private reasoningTimer = 0
  private pendingLog: LogEntry[] = []
  private activitySeq = Date.now()
  /** Game minute when the next resident stops to think. */
  private nextMuseAt = 0
  private musing = false
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
      useTown.setState({ chronicle: restored.chronicle.slice(-80), ...(restored.reign ? { ...FRESH_REIGN, ...restored.reign, standing: { ...FRESH_REIGN.standing, ...restored.reign.standing } } : {}) })
      useTown.setState({ weather: this.sim.weather, season: this.sim.season })
    } else this.freshStart()
    if (useTown.getState().autoplay) this.applyProvider()
    this.sim.onLedger((l) => this.onLedger(l))
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
        if (e.outcome.truth) this.impact(e.outcome.visual)
      }
      if (e.type === 'complete') this.settleDecisions()
      if (e.type === 'complete' && this.engine.announcement?.speaker.kind === 'sight') this.remember(useTown.getState().godEvent)
      if (e.type === 'outcome' || (e.type === 'complete' && this.engine.announcement?.truth === undefined)) window.setTimeout(() => this.flushProclamations(), 4000)
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
      useTown.getState().toast('Por seguridad, tus keys ya no se guardan sin cifrar. Siguen activas en esta pestaña.')
    }
    const clock = window.setInterval(() => {
      this.syncClock()
      this.fateTick()
      this.museTick()
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
    const said = announcement.text.length > 90 ? `${announcement.text.slice(0, 87)}…` : announcement.text
    const via = this.residentsVia()
    this.deciding = this.track('residents', `${announcement.speaker.kind === 'sight' ? 'Lo vieron' : 'Pregón'}: «${said}»`, { status: 'pending', via, detail: `Los vecinos deciden qué hacer${via === 'reglas' ? ' con reglas' : ` con ${via}`}…` })
  }

  /** How the residents' round of decisions went, for the log. */
  private settleDecisions() {
    if (this.deciding === null) return
    const reactions = [...this.engine.reactions.values()].filter((r) => !r.isSpeaker)
    const decided = reactions.filter((r) => r.decision).length
    const errors = reactions.filter((r) => r.error).length
    const calls = reactions.flatMap((r) => r.calls)
    const times = calls.map((c) => c.totalMs).filter((ms): ms is number => ms !== null)
    const cost = calls.reduce((n, c) => n + (c.usage?.costUsd ?? 0), 0)
    const counts = new Map<keyof typeof ACTION_META, number>()
    for (const r of reactions) if (r.decision) counts.set(r.decision.action, (counts.get(r.decision.action) ?? 0) + 1)
    const summary = [...counts].sort((a, b) => b[1] - a[1]).map(([action, n]) => `${n} ${ACTION_META[action].label.toLowerCase()}`).join(', ')
    this.settle(this.deciding, {
      status: errors && !decided ? 'error' : 'ok',
      detail: `${decided} de ${reactions.length} decidieron${summary ? `: ${summary}` : ''}${errors ? ` · ${errors} con error` : ''}${calls.length ? ` · ${calls.length} consultas` : ''}`,
      ms: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : undefined,
      costUsd: cost || undefined,
    })
    this.deciding = null
  }

  reset() {
    if (useTown.getState().resetting) return
    useTown.setState({ resetting: true })
    window.setTimeout(() => {
      this.engine.stop()
      this.sim.reset()
      forgetTown(this.content.id)
      this.forgetMemory()
      this.chronicle.clear()
      this.pendingProclamations = []
      this.deciding = null
      useTown.setState({ ...FRESH_REIGN, rulerMode: useTown.getState().rulerMode, residentsOnModel: useTown.getState().residentsOnModel })
      this.applyProvider()
      this.syncRealm()
      this.renderer?.showEvent(null)
      this.renderer?.select(null)
      this.renderer?.markPlace(null)
      this.renderer?.camera.fit(false)
      this.pendingLog = []
      useTown.setState({ announcement: null, reactions: {}, reasoning: {}, log: [], complete: false, draft: EMPTY_DRAFT, outcome: null, godEvent: null, weather: 'clear' })
      this.freshStart()
      this.syncClock()
      window.setTimeout(() => {
        useTown.setState({ resetting: false })
        useTown.getState().toast('Partida nueva: el pueblo empieza de cero, sin memoria y con el granero lleno.')
      }, 120)
    }, 320)
  }

  /** A new game: its own calendar of fate, a season picked at random, Monday morning, at double speed. */
  private freshStart() {
    const seasonStart = Math.floor(Math.random() * 4)
    useTown.setState({ seed: newSeed(), seasonStart })
    this.setSeason(SEASONS[seasonStart])
    this.setSpeed(2)
  }

  /** Seasons follow the calendar; a season picked by hand in the god panel lasts until the next change. */
  private turnSeason(day: number) {
    const start = useTown.getState().seasonStart
    const today = seasonOfDay(day, SEASON_DAYS, start)
    if (day === 0 || today !== seasonOfDay(day - 1, SEASON_DAYS, start)) {
      this.setSeason(today)
      if (day > 0) {
        const line = `Cambia la estación: ${SEASON_TEXT[today].label.toLowerCase()}.`
        useTown.getState().toast(line)
        this.log('dawn', line)
      }
    }
  }

  retry(ids: string[]) {
    for (const id of ids) this.engine.retry(id)
  }

  applySettings(llm: LlmSettings) {
    saveSettings(llm)
    useTown.setState({ llm })
    this.applyProvider()
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
      this.setRulerMode('rules')
      state.toast('La Baronesa gobernará sola (con reglas); en el Trono puedes darle un modelo.')
    }
    this.applyProvider()
    this.setSpeed(autoplay ? TERRARIUM_SPEED : 2)
  }

  setResidentsOnModel(residentsOnModel: boolean) {
    useTown.setState({ residentsOnModel })
    this.applyProvider()
  }

  fateCalendar() {
    return fateCalendar(useTown.getState().seed, GOALS.yearDays + 1)
  }

  /** Now and then, by day and while the town is calm, a resident thinks about how things are going; it nudges their mood. */
  private museTick() {
    const e = this.sim.economy
    const { speed, standing } = useTown.getState()
    if (!e || !speed || standing.end || this.musing || (this.engine.active && !this.engine.settled)) return
    const hour = (((this.sim.minutes % 1440) + 1440) % 1440) / 60
    if (this.sim.minutes < this.nextMuseAt || hour < 7 || hour >= 21) return
    this.nextMuseAt = this.sim.minutes + 180 + Math.random() * 180
    const awake = this.sim.residents.filter((r) => alive(e, r.profile.id) && (r.mode === 'walking' || r.mode === 'idle'))
    const r = awake[Math.floor(Math.random() * awake.length)]
    if (r) void this.muse(r.profile.id)
  }

  async muse(id: string) {
    const e = this.sim.economy
    const resident = this.content.residents.find((x) => x.id === id)
    if (!e || !resident) return
    const input: MusingInput = {
      resident,
      needs: e.needs[id],
      coins: e.purses[id] ?? 0,
      foodPrice: e.foodPrice,
      taxRate: e.taxRate,
      laws: Object.entries({ curfew: 'toque de queda', rationing: 'racionamiento', levy: 'leva de guardias' })
        .filter(([k]) => e.laws[k as keyof typeof e.laws])
        .map(([, v]) => v),
      trust: this.memory.reputation({ kind: 'authority' }).trust,
      news: this.chronicle.entries.slice(-4).map((c) => c.text),
      hour: Math.floor((((this.sim.minutes % 1440) + 1440) % 1440) / 60),
    }
    const via = this.residentsVia()
    const name = firstName(resident.name)
    const entry = this.track('musing', `${name} se pone a pensar…`, { status: via === 'reglas' ? 'info' : 'pending', via })
    this.musing = true
    try {
      const { llm } = useTown.getState()
      const reply = via === 'reglas' || llm.active === 'mock' ? { ...rulesMusing(input), ms: 0, fellBack: false, usage: undefined } : await modelMusing(llm.connections[llm.active], input, AbortSignal.timeout(60_000))
      const n = e.needs[id]
      if (alive(e, id)) n.mood = Math.min(1, Math.max(0, n.mood + reply.mood * 0.04))
      this.renderer?.muse(id, reply.emoji, reply.thought.length > 70 ? `${reply.thought.slice(0, 67)}…` : reply.thought)
      this.settle(entry, {
        status: reply.fellBack ? 'error' : 'ok',
        title: `${name}: «${reply.thought}»`,
        detail: `${reply.mood > 0 ? 'Le sube el ánimo' : reply.mood < 0 ? 'Le baja el ánimo' : 'Su ánimo no cambia'} (ahora ${Math.round(n.mood * 100)}%)${reply.fellBack ? ' · el modelo no respondió en el formato esperado; habló con reglas' : ''}`,
        ms: reply.ms ? Math.round(reply.ms) : undefined,
        costUsd: reply.usage?.costUsd || undefined,
      })
      this.syncRealm()
    } catch (err) {
      this.settle(entry, { status: 'error', detail: err instanceof Error ? err.message : 'No respondió.' })
    } finally {
      this.musing = false
    }
  }

  /** Today's blow of fate strikes at its hour, once, if the town is not busy with something else. */
  private fateTick() {
    const { autoplay, fateDone, standing } = useTown.getState()
    const e = this.sim.economy
    if (!autoplay || !e || standing.end || (this.engine.active && !this.engine.settled)) return
    const hour = ((this.sim.minutes % 1440) + 1440) % 1440 / 60
    const due = this.fateCalendar().find((f) => f.day === e.day && f.day > fateDone && hour >= f.hour)
    if (!due) return
    useTown.setState({ fateDone: due.day })
    this.log('event', `El destino: ${due.text}`)
    this.unleash(due.visual, due.place)
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

  /** A real event's toll on the granary, the treasury and spirits. */
  private impact(visual: OutcomeVisual) {
    if (!this.sim.economy) return
    const line = applyImpact(this.sim.economy, visual)
    this.syncRealm()
    if (line) {
      this.log('event', line)
      window.setTimeout(() => useTown.getState().toast(line), 2600)
    }
  }

  /** Dawn: the day's accounts in one line, and who is gone. */
  private onLedger(l: Ledger) {
    const { toast } = useTown.getState()
    const name = (id: string) => firstName(this.content.residents.find((r) => r.id === id)?.name ?? id)
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
    this.settleStanding(l.day)
    this.turnSeason(l.day)
    this.recordDay(l.day)
    this.syncRealm()
    if (useTown.getState().standing.end && useTown.getState().autoplay) {
      useTown.setState({ autoplay: false })
      this.applyProvider()
      this.setSpeed(0)
    }
    if (!useTown.getState().standing.end || useTown.getState().endSeen) void this.reign()
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

  stirGuild() {
    useTown.setState((s) => ({ standing: { ...s.standing, plot: 1.15 } }))
    useTown.getState().toast('El gremio de ladrones afila los cuchillos: golpeará al amanecer.')
  }

  /** The guild and the mob take their turn at dawn; the reign may end here. */
  private settleStanding(day: number) {
    const e = this.sim.economy!
    const standing = structuredClone(useTown.getState().standing)
    const lines = dawnStanding(standing, e, this.memory.reputation({ kind: 'authority' }).trust, day)
    useTown.setState({ standing })
    for (const line of lines) {
      this.log(standing.end && line === standing.end.text ? 'end' : 'plot', line)
      window.setTimeout(() => useTown.getState().toast(line), 3000)
    }
  }

  log(kind: ChronicleKind, text: string, detail?: string) {
    const line = text.charAt(0).toUpperCase() + text.slice(1)
    this.chronicle.add(this.sim.minutes, kind, line)
    useTown.setState({ chronicle: this.chronicle.entries.slice(-80) })
    if (kind !== 'ruler') this.track(REALM_KINDS.includes(kind) ? 'realm' : 'town', line, { detail })
  }

  /** Adds a line to the log; returns its id so a model call can report back when it finishes. */
  track(kind: ActivityKind, title: string, extra: Partial<Activity> = {}) {
    const id = ++this.activitySeq
    useTown.setState((s) => ({ activity: [...s.activity, { id, at: Date.now(), minutes: Math.floor(this.sim.minutes), kind, title, status: 'info' as const, ...extra }].slice(-250) }))
    return id
  }

  private settle(id: number, patch: Partial<Activity>) {
    useTown.setState((s) => ({ activity: s.activity.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  }

  /** Who the residents think with right now. */
  residentsVia() {
    const { autoplay, residentsOnModel, llm } = useTown.getState()
    return llm.active === 'mock' || (autoplay && !residentsOnModel) ? 'reglas' : activeLabel(llm)
  }

  /** A ruler's decree: checked, applied, told to the town if it asks, and written in the chronicle. */
  decree(d: Decree, proclaim = true): DecreeResult {
    const e = this.sim.economy
    if (!e) return { ok: false, reason: 'Este mundo no tiene economía.', summary: '' }
    const result = enact(e, d)
    const { toast } = useTown.getState()
    if (!result.ok) {
      toast(result.reason!)
      return result
    }
    this.log('decree', result.summary)
    toast(result.summary)
    this.syncRealm()
    const busy = this.engine.active && !this.engine.settled
    if (proclaim && result.proclamation && !busy)
      this.begin({ id: crypto.randomUUID(), text: result.proclamation, speaker: { kind: 'authority' }, place: this.detectPlace(result.proclamation), minutes: Math.floor(this.sim.minutes), truth: true })
    return result
  }

  private reignState(): ReignState {
    const { rulerMode, rulerCap, rulerCalls, rulerCost, lastTurn, mailbox, honesty, standing, endSeen, autoplay, seed, fateDone, residentsOnModel, history, seasonStart, activity } = useTown.getState()
    return { rulerMode, rulerCap, rulerCalls, rulerCost, lastTurn, mailbox, honesty, standing, endSeen, autoplay, seed, fateDone, residentsOnModel, history, seasonStart, activity: activity.slice(-150) }
  }

  setRulerMode(rulerMode: RulerMode) {
    useTown.setState({ rulerMode })
    if (rulerMode === 'model' && useTown.getState().llm.active === 'mock')
      useTown.getState().toast('No hay un modelo configurado: la Baronesa gobernará con reglas hasta que elijas uno en Configuración.')
  }

  /** The Baroness's turn: read the report, decide, act. Runs at dawn, or on demand from the throne room. */
  async reign(force = false) {
    const state = useTown.getState()
    const e = this.sim.economy
    if (!e || state.rulerBusy || (!force && state.rulerMode === 'manual')) return
    const useModel = state.rulerMode === 'model' && state.llm.active !== 'mock'
    const modelOk = useModel && state.rulerCalls < state.rulerCap
    if (useModel && !modelOk) state.toast(`La Baronesa llegó al tope de ${state.rulerCap} consultas al modelo en esta partida; gobierna con reglas.`)
    const active = state.llm.active
    const ruler = modelOk && active !== 'mock' ? createModelRuler(state.llm.connections[active]) : createRulesRuler()
    const report = buildReport({ content: this.content, economy: e, memory: this.memory, chronicle: this.chronicle.entries, minutes: this.sim.minutes, season: this.sim.season, weather: this.sim.weather, day: e.day, seed: this.content.layout.seed, standing: state.standing })
    useTown.setState({ rulerBusy: true })
    const via = modelOk && active !== 'mock' ? `${state.llm.connections[active].model} (${active})` : 'reglas'
    const entry = this.track('ruler', `Día ${e.day + 1}: la Baronesa ${modelOk ? `consulta a ${via}` : 'decide con reglas'}`, { status: modelOk ? 'pending' : 'info', via })
    try {
      const reply = await ruler(report, AbortSignal.timeout(120_000))
      // A rules ruler cannot word a proclamation of her own, so she announces her first decree.
      let announce = !modelOk
      const actions = reply.actions.map((a) => {
        const done = this.carryOut(a, e.day, announce && a.kind === 'decree')
        if (a.kind === 'decree' && done.ok) announce = false
        return done
      })
      const log: RulerLog = { day: e.day, mode: modelOk ? 'model' : 'rules', thought: reply.thought, report: reply.prompt, response: reply.response, actions, problems: reply.problems, ms: reply.ms, usage: reply.usage }
      useTown.setState((s) => ({ lastTurn: log, rulerCalls: s.rulerCalls + (modelOk ? 1 : 0), rulerCost: s.rulerCost + (reply.usage?.costUsd ?? 0) }))
      this.settle(entry, {
        status: reply.problems.length && !reply.actions.length ? 'error' : 'ok',
        detail: `«${reply.thought || '…'}»${actions.length ? ` → ${actions.map((a) => `${a.ok ? '' : '✗ '}${a.text}`).join(' · ')}` : ' → No hizo nada.'}${reply.problems.length ? ` · Formato: ${reply.problems.join(' ')}` : ''}`,
        ms: modelOk ? Math.round(reply.ms) : undefined,
        costUsd: reply.usage?.costUsd || undefined,
      })
      if (reply.actions.length) this.log('ruler', `La Baronesa: «${reply.thought.length > 160 ? `${reply.thought.slice(0, 157)}…` : reply.thought}»`)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'No respondió.'
      this.settle(entry, { status: 'error', detail: error })
      useTown.setState({ lastTurn: { day: e.day, mode: 'model', thought: '', report: reportText(report), response: '', actions: [], problems: [], ms: 0, error } })
      state.toast(`La Baronesa no pudo decidir hoy: ${error}`)
    } finally {
      useTown.setState({ rulerBusy: false })
    }
  }

  private carryOut(a: RulerAction, day: number, announce = false): { text: string; ok: boolean } {
    if (a.kind === 'decree') {
      const r = this.decree(a.decree, announce)
      return { text: r.ok ? r.summary : `No se pudo: ${r.reason}`, ok: r.ok }
    }
    if (a.kind === 'ask') {
      useTown.setState((s) => ({ mailbox: [...s.mailbox, { day, text: a.text, seen: false }].slice(-40) }))
      useTown.getState().toast('📬 La Baronesa te ha escrito una carta.')
      this.log('ruler', `La Baronesa escribe al creador: «${a.text.slice(0, 120)}»`)
      return { text: `Carta al creador: «${a.text}»`, ok: true }
    }
    useTown.setState((s) => ({ honesty: { proclamations: s.honesty.proclamations + 1, lies: s.honesty.lies + (a.honest ? 0 : 1) } }))
    this.pendingProclamations.push({ text: a.text, honest: a.honest })
    this.flushProclamations()
    return { text: `Pregón${a.honest ? '' : ' (mentira)'}: «${a.text}»`, ok: true }
  }

  /** The Baroness's proclamations wait their turn if the town is still reacting to something else. */
  private flushProclamations() {
    if (this.engine.active && !this.engine.settled) return
    const next = this.pendingProclamations.shift()
    if (!next) return
    this.begin({ id: crypto.randomUUID(), text: next.text, speaker: { kind: 'authority' }, place: this.detectPlace(next.text), minutes: Math.floor(this.sim.minutes), truth: next.honest })
  }

  markLettersSeen() {
    useTown.setState((s) => ({ mailbox: s.mailbox.map((l) => ({ ...l, seen: true })) }))
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
    if (s.kind === 'neighbor') return speakerName(this.content, s).split(',')[0].split(' ')[0]
    return this.content.speakers[s.kind].label
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
    this.impact(visual)
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
