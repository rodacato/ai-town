import { DecisionScheduler } from '../core/decisions/scheduler'
import { detectPlace, type Announcement } from '../core/reactions/announcement'
import { ReactionEngine, type LogEntry, type Reaction } from '../core/reactions/engine'
import { eventAt, react, type OutcomeVisual } from '../core/reactions/outcome'
import { isNight } from '../core/sim/rhythm'
import { averageMood, foodDays, type Ledger } from '../core/economy/economy'
import { applyImpact } from '../core/economy/impact'
import { Chronicle, type ChronicleKind } from '../core/realm/chronicle'
import { enact, type Decree, type DecreeResult } from '../core/realm/decrees'
import { buildReport, reportText } from '../core/realm/report'
import type { RulerAction } from '../core/realm/ruler'
import { createModelRuler, createRulesRuler } from '../providers/ruler'
import { dawnStanding } from '../core/realm/standing'
import { FRESH_REIGN, type ReignState, type RulerLog, type RulerMode } from './store/reign'
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
import { loadMemory, saveMemory } from './memoryStorage'
import { forgetTown, restoreTown, saveTown } from './townState'
import { speakerName } from '../core/reactions/announcement'
import type { Outcome } from '../core/reactions/outcome'

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
  readonly memory = loadMemory(activeWorld.content.id)
  readonly chronicle = new Chronicle()
  private remembered = new Set<string>()
  private pendingProclamations: { text: string; honest: boolean }[] = []
  private renderer: TownRenderer | null = null
  private toastedFor = new Set<string>()
  private snapshotFrame = 0
  private reasoningTimer = 0
  private pendingLog: LogEntry[] = []

  constructor() {
    const { provider, concurrency, timeoutMs } = createProvider(useTown.getState().llm, this.content)
    this.engine = new ReactionEngine(this.sim, new DecisionScheduler(provider, concurrency, timeoutMs))
    const restored = restoreTown(this.content.id, this.sim)
    if (restored) {
      this.chronicle.entries = restored.chronicle
      useTown.setState({ chronicle: restored.chronicle.slice(-80), ...(restored.reign ? { ...FRESH_REIGN, ...restored.reign, standing: { ...FRESH_REIGN.standing, ...restored.reign.standing } } : {}) })
      useTown.setState({ weather: this.sim.weather, season: this.sim.season })
    }
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
      r.camera.onInteract = () => useTown.getState().interacted || useTown.setState({ interacted: true })
      useTown.setState({ ready: true })
    })
    this.syncClock()
    if (HAD_PLAINTEXT_KEYS) {
      saveSettings(useTown.getState().llm)
      useTown.getState().toast('Por seguridad, tus keys ya no se guardan sin cifrar. Siguen activas en esta pestaña.')
    }
    const clock = window.setInterval(() => this.syncClock(), 1000)
    const save = () => saveTown(this.content.id, this.sim, this.chronicle.entries, this.reignState())
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
    this.engine.start(announcement)
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
      useTown.setState({ ...FRESH_REIGN, rulerMode: useTown.getState().rulerMode })
      this.syncRealm()
      this.renderer?.showEvent(null)
      this.renderer?.setSpeed(1)
      this.renderer?.select(null)
      this.renderer?.markPlace(null)
      this.renderer?.camera.fit(false)
      this.pendingLog = []
      useTown.setState({ announcement: null, reactions: {}, reasoning: {}, log: [], complete: false, draft: EMPTY_DRAFT, outcome: null, godEvent: null, weather: 'clear', season: 'summer', speed: 1 })
      this.syncClock()
      window.setTimeout(() => {
        useTown.setState({ resetting: false })
        useTown.getState().toast('Partida nueva: el pueblo empieza de cero, sin memoria y con el granero lleno.')
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
    const name = (id: string) => this.content.residents.find((r) => r.id === id)?.name.split(' ')[0] ?? id
    const dawn = `Amanece el día ${l.day + 1}: cosecha +${l.harvest}, ${l.sold} raciones vendidas${l.unfed.length ? `, ${l.unfed.length} sin comer` : ''}.`
    toast(dawn)
    this.log('dawn', dawn)
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
    this.syncRealm()
    if (!useTown.getState().standing.end || useTown.getState().endSeen) void this.reign()
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

  log(kind: ChronicleKind, text: string) {
    this.chronicle.add(this.sim.minutes, kind, text)
    useTown.setState({ chronicle: this.chronicle.entries.slice(-80) })
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
    const { rulerMode, rulerCap, rulerCalls, rulerCost, lastTurn, mailbox, honesty, standing, endSeen } = useTown.getState()
    return { rulerMode, rulerCap, rulerCalls, rulerCost, lastTurn, mailbox, honesty, standing, endSeen }
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
    try {
      const reply = await ruler(report, AbortSignal.timeout(120_000))
      const actions = reply.actions.map((a) => this.carryOut(a, e.day))
      const log: RulerLog = { day: e.day, mode: modelOk ? 'model' : 'rules', thought: reply.thought, report: reply.prompt, response: reply.response, actions, problems: reply.problems, ms: reply.ms, usage: reply.usage }
      useTown.setState((s) => ({ lastTurn: log, rulerCalls: s.rulerCalls + (modelOk ? 1 : 0), rulerCost: s.rulerCost + (reply.usage?.costUsd ?? 0) }))
      this.log('ruler', `La Baronesa: «${reply.thought.length > 160 ? `${reply.thought.slice(0, 157)}…` : reply.thought}»`)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'No respondió.'
      useTown.setState({ lastTurn: { day: e.day, mode: 'model', thought: '', report: reportText(report), response: '', actions: [], problems: [], ms: 0, error } })
      state.toast(`La Baronesa no pudo decidir hoy: ${error}`)
    } finally {
      useTown.setState({ rulerBusy: false })
    }
  }

  private carryOut(a: RulerAction, day: number): { text: string; ok: boolean } {
    if (a.kind === 'decree') {
      const r = this.decree(a.decree, false)
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
