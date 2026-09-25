import { alive, type Economy } from '../core/economy/economy'
import { applyImpact, EFFECTS, guardDeed, rollHours } from '../core/economy/impact'
import { firstName, nameOf as residentName } from '../core/lang'
import type { MemoryEntry, TownMemory } from '../core/memory/memory'
import type { OutcomeVisual } from '../core/reactions/outcome'
import type { Chronicle, ChronicleKind } from '../core/realm/chronicle'
import { dueFate, splitDue } from '../core/realm/fate'
import { musingInputFor, rulesMusing } from '../core/realm/musing'
import { fateCalendar } from '../core/realm/reign'
import { GOALS } from '../core/realm/standing'
import { hourOf } from '../core/sim/clock'
import type { Simulation } from '../core/sim/simulation'
import { clip } from '../core/format'
import { modelMusing } from '../providers/musing'
import { useTown } from './store'
import { byRules } from './via'
import type { Activity, ActivityKind } from './store/reign'

/** What the terrarium needs from the town around it. */
export interface TerrariumHost {
  readonly sim: Simulation
  readonly memory: TownMemory
  readonly chronicle: Chronicle
  /** A new game has begun since this number was read. */
  readonly generation: number
  busy(): boolean
  unleash(visual: OutcomeVisual, placeId: string): void
  clearEvent(): void
  showThought(id: string, emoji: string, text: string): void
  log(kind: ChronicleKind, text: string, detail?: string): void
  track(kind: ActivityKind, title: string, extra?: Partial<Activity>): number
  settle(id: number, patch: Partial<Activity>): void
  rememberDeed(deed: MemoryEntry): void
  residentsVia(): string
  syncRealm(): void
}

/** The town running on its own: blows of fate on their calendar, events that last and then weigh, residents who stop to think. */
export class Terrarium {
  /** Game minute when the next resident stops to think. */
  private nextMuseAt = 0
  private musing = false

  constructor(private host: TerrariumHost) {}

  private get economy(): Economy | null {
    return this.host.sim.economy
  }

  private nameOf = (id: string) => residentName(this.host.sim.content, id)

  calendar() {
    return fateCalendar(this.host.sim.content, useTown.getState().seed, GOALS.yearDays + 1, useTown.getState().difficulty)
  }

  /** Called every real second. */
  tick() {
    this.strike()
    this.settleEvents()
    this.maybeMuse()
  }

  reset() {
    this.nextMuseAt = 0
  }

  /** Today's blow of fate strikes at its hour, once, if the town is not busy with something else. */
  private strike() {
    const { autoplay, fateDone, standing } = useTown.getState()
    const e = this.economy
    if (!autoplay || !e || standing.end || this.host.busy()) return
    const due = dueFate(this.calendar(), e.day, hourOf(this.host.sim.minutes), fateDone)
    if (!due) return
    useTown.setState({ fateDone: due.day })
    this.host.log('event', `El destino: ${due.text}`)
    this.host.unleash(due.visual, due.place)
  }

  /** A real event starts: it lasts a random while, and only when it is over do its costs or gains land. */
  beginEvent(visual: OutcomeVisual, summary: string) {
    if (!this.economy || !EFFECTS[visual]) return
    const hours = rollHours(visual)
    const activity = this.host.track('town', `En curso: ${summary}`, { status: 'pending', detail: 'Su costo o beneficio depende de cuánto dure.' })
    useTown.setState((s) => ({ events: [...s.events, { visual, summary, until: Math.floor(this.host.sim.minutes + hours * 60), hours, activity }] }))
  }

  /** Settles the events whose time is up: the longer they lasted, the more they cost or paid. */
  private settleEvents() {
    const e = this.economy
    const { due, going } = splitDue(useTown.getState().events, this.host.sim.minutes)
    if (!e || !due.length) return
    useTown.setState({ events: going })
    for (const x of due) {
      const impact = applyImpact(e, x.visual, x.hours, Math.random, this.nameOf)
      const deed = guardDeed(impact, x.visual, this.host.sim.minutes)
      if (deed) this.host.rememberDeed(deed)
      if (!impact.text) continue
      this.host.chronicle.add(this.host.sim.minutes, 'event', impact.text)
      useTown.setState({ chronicle: this.host.chronicle.entries.slice(-80) })
      const guard = impact.guarded === null ? '' : impact.guarded ? ' · la guardia cumplió: sube la confianza' : ' · sin leva, nadie lo frenó: baja la confianza'
      this.host.settle(x.activity, { status: 'ok', title: impact.text, detail: `Duró ${x.hours} ${x.hours === 1 ? 'hora' : 'horas'}${guard}` })
      useTown.getState().toast(impact.text)
      if (useTown.getState().godEvent?.visual === x.visual && !this.host.busy()) this.host.clearEvent()
    }
    this.host.syncRealm()
  }

  /** Now and then, by day and while the town is calm, a resident thinks about how things are going. */
  private maybeMuse() {
    const e = this.economy
    const { speed, standing } = useTown.getState()
    if (!e || !speed || standing.end || this.musing || this.host.busy()) return
    const hour = hourOf(this.host.sim.minutes)
    if (this.host.sim.minutes < this.nextMuseAt || hour < 7 || hour >= 21) return
    this.nextMuseAt = this.host.sim.minutes + 180 + Math.random() * 180
    const awake = this.host.sim.residents.filter((r) => alive(e, r.profile.id) && (r.mode === 'walking' || r.mode === 'idle'))
    const r = awake[Math.floor(Math.random() * awake.length)]
    if (r) void this.muse(r.profile.id)
  }

  /** A resident thinks, with the residents' model or by rules; the thought nudges their mood. */
  async muse(id: string) {
    const e = this.economy
    const resident = this.host.sim.content.residents.find((x) => x.id === id)
    if (!e || !resident) return
    const input = musingInputFor(e, resident, {
      trust: this.host.memory.reputation({ kind: 'authority' }).trust,
      news: this.host.chronicle.entries.slice(-4).map((c) => c.text),
      minutes: this.host.sim.minutes,
      world: this.host.sim.content,
    })
    const via = this.host.residentsVia()
    const name = firstName(resident.name)
    const entry = this.host.track('musing', `${name} se pone a pensar…`, { status: byRules(via) ? 'info' : 'pending', via })
    this.musing = true
    try {
      const { llm } = useTown.getState()
      const gen = this.host.generation
      const reply = byRules(via) || llm.active === 'mock' ? { ...rulesMusing(input), ms: 0, fellBack: false, usage: undefined } : await modelMusing(llm.connections[llm.active], input, AbortSignal.timeout(60_000))
      if (gen !== this.host.generation) return
      const n = e.needs[id]
      if (alive(e, id)) n.mood = Math.min(1, Math.max(0, n.mood + reply.mood * 0.04))
      this.host.showThought(id, reply.emoji, clip(reply.thought, 70))
      this.host.settle(entry, {
        status: reply.fellBack ? 'error' : 'ok',
        title: `${name}: «${reply.thought}»`,
        detail: `${reply.mood > 0 ? 'Le sube el ánimo' : reply.mood < 0 ? 'Le baja el ánimo' : 'Su ánimo no cambia'} (ahora ${Math.round(n.mood * 100)}%)${reply.fellBack ? ' · el modelo no respondió en el formato esperado; habló con reglas' : ''}`,
        ms: reply.ms ? Math.round(reply.ms) : undefined,
        costUsd: reply.usage?.costUsd || undefined,
        costEstimated: reply.usage?.costSource === 'table',
        tokensIn: reply.usage?.inputTokens,
        tokensOut: reply.usage?.outputTokens,
      })
      this.host.syncRealm()
    } catch (err) {
      this.host.settle(entry, { status: 'error', detail: err instanceof Error ? err.message : 'No respondió.' })
    } finally {
      this.musing = false
    }
  }
}
