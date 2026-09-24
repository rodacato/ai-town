import type { DecisionScheduler } from '../decisions/scheduler'
import type { Decision, Rumor, TokenUsage } from '../decisions/types'
import { toPlace } from '../lang'
import type { Resident, Simulation, Task } from '../sim/simulation'
import type { Point } from '../world/types'
import type { Announcement } from './announcement'
import { buildContext } from './context'
import { judge, planOutcome, react, THREATS, type Outcome } from './outcome'
import type { TownMemory } from '../memory/memory'
import { firstName as first } from '../lang'

export type Phase = 'unaware' | 'heard' | 'thinking' | 'decided' | 'error'

export interface Reaction {
  id: string
  isSpeaker: boolean
  phase: Phase
  /** How the news reached them: the broadcast itself, or word of mouth from another resident. */
  heardVia: 'broadcast' | string | null
  heardAt: number | null
  startedAt: number | null
  decidedAt: number | null
  latencyMs: number | null
  queuedAt: number | null
  firstTokenAt: number | null
  /** The exact exchange with the provider, kept for the inspector. */
  request: { system: string; prompt: string } | null
  response: string | null
  usage: TokenUsage | null
  decidedBy: string | null
  reasoning: string
  decision: Decision | null
  previous: Decision | null
  revisedBy: string | null
  rumors: Rumor[]
  told: string[]
  error: string | null
  calls: CallRecord[]
  /** Set once the truth is revealed: whether their belief matched it. */
  verdict: { right: boolean; note: string } | null
}

/** One round trip to the decision provider; a resident who reconsiders makes several. */
export interface CallRecord {
  provider: string
  /** Relative to when the announcement was made. */
  at: number
  queueMs: number
  ttftMs: number | null
  totalMs: number | null
  usage: TokenUsage | null
  action: Decision['action'] | null
  believes: boolean | null
  error: string | null
  revision: boolean
}

export interface LogEntry {
  at: number
  id: string
  kind: 'queued' | 'sent' | 'streaming' | 'decided' | 'error' | 'told'
  detail: string
}

export type EngineEvent =
  | { type: 'log'; entry: LogEntry }
  | { type: 'change'; id: string }
  | { type: 'reasoning'; id: string }
  | { type: 'told'; from: string; to: string }
  | { type: 'complete' }
  | { type: 'outcome'; outcome: Outcome }

const WAVE_SPEED = 6
const HEAR_PAUSE = 0.7
const SPEECH_PAUSE = 1.4
const INDOOR_DELAY = 0.6
/** Seconds after the last decision before the truth shows, so people have time to get where they were going. */
const REVEAL_DELAY = 7


export class ReactionEngine {
  announcement: Announcement | null = null
  origin: Point = { x: 0, y: 0 }
  waveRadius = 0
  waveMax = 0
  reactions = new Map<string, Reaction>()
  private timers = new Map<string, { at: number; run: () => void }>()
  private timerSeq = 0
  private listeners = new Set<(e: EngineEvent) => void>()
  private clock = 0
  private completed = false
  private revealing = false
  outcome: Outcome | null = null
  /** The town's memory, when this engine runs the live town; the benchmark leaves it out. */
  memory: TownMemory | null = null
  startedAt = 0

  constructor(
    private sim: Simulation,
    readonly scheduler: DecisionScheduler,
  ) {
    sim.onTick((dt) => this.tick(dt))
  }

  on(fn: (e: EngineEvent) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  get active() {
    return !!this.announcement
  }

  get waveActive() {
    return !!this.announcement && this.waveRadius < this.waveMax + 4
  }

  start(a: Announcement) {
    this.stop()
    this.announcement = a
    this.completed = false
    this.revealing = false
    this.outcome = null
    this.startedAt = performance.now()
    this.origin = this.originFor(a)
    this.waveRadius = 0
    const farthest = Math.max(...this.sim.residents.map((r) => Math.hypot(r.x - this.origin.x, r.y - this.origin.y))) + INDOOR_DELAY * WAVE_SPEED
    this.waveMax = a.reach ?? farthest
    for (const r of this.sim.residents) {
      const id = r.profile.id
      const isSpeaker = a.speaker.kind === 'neighbor' && a.speaker.residentId === id
      this.reactions.set(id, {
        id,
        isSpeaker,
        phase: isSpeaker ? 'decided' : 'unaware',
        heardVia: isSpeaker ? 'broadcast' : null,
        heardAt: null,
        startedAt: null,
        decidedAt: null,
        latencyMs: null,
        queuedAt: null,
        firstTokenAt: null,
        request: null,
        response: null,
        usage: null,
        calls: [],
        verdict: null,
        decidedBy: null,
        reasoning: '',
        decision: null,
        previous: null,
        revisedBy: null,
        rumors: [],
        told: [],
        error: null,
      })
      if (isSpeaker) {
        this.sim.assign(r, [{ kind: 'wait', seconds: 4, label: 'Hizo el anuncio' }])
        r.frozen = true
        this.later(id, 3.5, () => (r.frozen = false))
      }
      this.emit({ type: 'change', id })
    }
  }

  stop() {
    this.scheduler.cancelAll()
    this.timers.clear()
    for (const r of this.sim.residents) r.frozen = false
    this.reactions.clear()
    this.announcement = null
    this.outcome = null
    this.waveRadius = 0
  }

  retry(id: string) {
    const reaction = this.reactions.get(id)
    if (reaction?.phase !== 'error') return
    this.request(this.sim.get(id)!, reaction)
  }

  get settled() {
    const all = [...this.reactions.values()].filter((r) => !r.isSpeaker)
    // With a limited reach, those it never got to are done too once the wave has passed.
    const passed = !this.waveActive
    return all.length > 0 && all.every((r) => r.phase === 'decided' || r.phase === 'error' || (passed && r.phase === 'unaware'))
  }

  private emit(e: EngineEvent) {
    for (const fn of this.listeners) fn(e)
  }

  private log(id: string, kind: LogEntry['kind'], detail = '') {
    this.emit({ type: 'log', entry: { at: performance.now(), id, kind, detail } })
  }

  private later(id: string, seconds: number, run: () => void) {
    this.timers.set(`${id}:${++this.timerSeq}`, { at: this.clock + seconds, run })
  }

  private originFor(a: Announcement): Point {
    if (a.origin) return a.origin
    if (a.speaker.kind === 'neighbor') {
      const r = this.sim.get(a.speaker.residentId!)
      if (r) return r.mode === 'inside' ? { x: this.sim.homeDoor(r).x + 0.5, y: this.sim.homeDoor(r).y + 0.5 } : { x: r.x, y: r.y }
    }
    if (a.speaker.kind === 'authority') {
      const d = this.sim.world.buildings.find((b) => b.id === this.sim.content.authorityOrigin.building)!.door
      return { x: d.x + 0.5, y: d.y + 0.5 }
    }
    const s = this.sim.content.strangerOrigin
    return { x: s.x + 0.5, y: s.y + 0.5 }
  }

  private tick(dt: number) {
    if (!this.announcement) return
    this.clock += dt
    for (const [key, t] of this.timers)
      if (t.at <= this.clock) {
        this.timers.delete(key)
        t.run()
      }
    if (this.waveRadius < this.waveMax + 4) {
      this.waveRadius += WAVE_SPEED * dt
      const reach = this.announcement.reach ?? Infinity
      for (const r of this.sim.residents) {
        const reaction = this.reactions.get(r.profile.id)!
        if (reaction.phase !== 'unaware') continue
        const d = Math.hypot(r.x - this.origin.x, r.y - this.origin.y) + (r.mode === 'inside' ? INDOOR_DELAY * WAVE_SPEED : 0)
        if (d <= Math.min(this.waveRadius, reach)) this.hear(r, reaction, 'broadcast')
      }
      if (this.waveRadius >= this.waveMax + 4) this.checkComplete()
    }
  }

  private hear(r: Resident, reaction: Reaction, via: string, faceTowards = via) {
    reaction.phase = 'heard'
    reaction.heardVia ??= via
    reaction.heardAt = performance.now()
    r.frozen = true
    r.chatting = null
    const target = faceTowards === 'broadcast' ? this.origin : this.sim.get(faceTowards)!
    const screenDx = target.x - target.y - (r.x - r.y)
    if (Math.abs(screenDx) > 0.1) r.facing = screenDx > 0 ? 1 : -1
    this.emit({ type: 'change', id: reaction.id })
    this.later(reaction.id, HEAR_PAUSE, () => this.request(r, reaction))
  }

  private request(r: Resident, reaction: Reaction) {
    const a = this.announcement!
    reaction.phase = 'thinking'
    reaction.reasoning = ''
    reaction.error = null
    reaction.startedAt = null
    reaction.firstTokenAt = null
    reaction.queuedAt = performance.now()
    reaction.request = null
    reaction.response = null
    reaction.usage = null
    r.frozen = true
    this.emit({ type: 'change', id: reaction.id })
    const ctx = buildContext(this.sim, a, r, reaction.rumors, reaction.decision, this.memory ?? undefined)
    const provider = this.scheduler.provider
    this.log(reaction.id, 'queued', provider.label)
    this.scheduler.enqueue({
      ctx,
      onStart: () => {
        reaction.startedAt = performance.now()
        this.log(reaction.id, 'sent', provider.label)
        this.emit({ type: 'change', id: reaction.id })
      },
      onRequest: (system, prompt) => (reaction.request = { system, prompt }),
      onResponse: (text, usage) => {
        reaction.response = text
        reaction.usage = usage ?? null
      },
      onReasoning: (delta) => {
        reaction.reasoning += delta
        if (reaction.firstTokenAt === null) {
          reaction.firstTokenAt = performance.now()
          this.log(reaction.id, 'streaming')
          this.emit({ type: 'change', id: reaction.id })
        }
        this.emit({ type: 'reasoning', id: reaction.id })
      },
      onDecision: (decision) => {
        reaction.decidedBy = provider.label
        this.record(reaction, provider.label, { action: decision.action, believes: decision.believes })
        this.decided(r, reaction, decision)
      },
      onError: (message) => {
        this.record(reaction, provider.label, { error: message })
        reaction.phase = 'error'
        reaction.error = message
        this.log(reaction.id, 'error', message)
        r.frozen = false
        this.emit({ type: 'change', id: reaction.id })
        this.checkComplete()
      },
    })
  }

  private record(reaction: Reaction, provider: string, outcome: Partial<CallRecord>) {
    const now = performance.now()
    const queued = reaction.queuedAt ?? now
    const started = reaction.startedAt
    reaction.calls.push({
      provider,
      at: queued - this.startedAt,
      queueMs: (started ?? now) - queued,
      ttftMs: started !== null && reaction.firstTokenAt !== null ? reaction.firstTokenAt - started : null,
      totalMs: started !== null ? now - started : null,
      usage: reaction.usage,
      action: null,
      believes: null,
      error: null,
      revision: reaction.decision !== null,
      ...outcome,
    })
  }

  private decided(r: Resident, reaction: Reaction, decision: Decision) {
    const previous = reaction.decision
    const changed = !!previous && previous.action !== decision.action
    if (previous) {
      reaction.previous = previous
      if (changed) reaction.revisedBy = reaction.rumors[reaction.rumors.length - 1]?.fromId ?? null
    }
    reaction.decision = decision
    reaction.reasoning = decision.reasoning
    if (this.outcome) reaction.verdict = judge(decision, this.outcome.truth)
    reaction.phase = 'decided'
    reaction.decidedAt = performance.now()
    reaction.latencyMs = reaction.decidedAt - (reaction.startedAt ?? reaction.decidedAt)
    this.log(reaction.id, 'decided', decision.action)
    this.emit({ type: 'change', id: reaction.id })
    this.later(reaction.id, SPEECH_PAUSE, () => {
      r.frozen = false
      if (!previous || changed) this.act(r, reaction, decision)
    })
    this.checkComplete()
  }

  private act(r: Resident, reaction: Reaction, d: Decision) {
    const a = this.announcement!
    const placeId = a.place && a.place !== 'home' ? a.place : this.sim.content.gatheringPlace
    const placeLabel = this.sim.world.places.find((p) => p.id === placeId)!.name
    const tasks: Task[] = d.tell
      .filter((id) => id !== r.profile.id)
      .map((id) => ({
        kind: 'meet' as const,
        who: id,
        seconds: 2.4,
        label: `Avisando a ${first(this.sim.get(id)!.profile.name)}`,
        onMeet: () => this.deliver(r, reaction, id),
      }))
    switch (d.action) {
      case 'go': {
        const spot = this.sim.spotAt(placeId)
        if (spot) tasks.push({ kind: 'walk', to: spot, label: `Camino ${toPlace(placeLabel)}` }, { kind: 'stay', label: `En ${placeLabel}, por el anuncio` })
        break
      }
      case 'stay_home':
        tasks.push({ kind: 'enterHome', label: 'Se resguarda en casa' })
        break
      case 'warn':
        if (a.place === 'home') tasks.push({ kind: 'enterHome', label: 'Se resguarda en casa' })
        break
      case 'investigate': {
        const spot = this.sim.lookoutFor(placeId, this.sim.tileOf(r))
        if (spot)
          tasks.push(
            { kind: 'walk', to: spot, label: `Se acerca ${toPlace(placeLabel)} con cautela` },
            { kind: 'wait', seconds: 14, label: `Observando ${placeLabel} de lejos` },
          )
        break
      }
      case 'ignore':
        break
    }
    this.sim.assign(r, tasks)
  }

  private deliver(from: Resident, fromReaction: Reaction, toId: string) {
    const to = this.sim.get(toId)!
    const target = this.reactions.get(toId)
    if (!target || target.isSpeaker) return
    fromReaction.told.push(toId)
    const rumor: Rumor = {
      fromId: from.profile.id,
      fromName: from.profile.name,
      relation: to.profile.relationships.find((rel) => rel.id === from.profile.id)?.label ?? null,
      message: fromReaction.decision?.speech ?? '',
    }
    target.rumors.push(rumor)
    this.emit({ type: 'told', from: from.profile.id, to: toId })
    this.log(from.profile.id, 'told', toId)
    this.emit({ type: 'change', id: fromReaction.id })
    if (target.phase === 'unaware') return this.hear(to, target, from.profile.id)
    if (target.phase === 'decided' && !target.previous && target.decision?.action !== fromReaction.decision?.action) {
      this.completed = false
      this.hear(to, target, 'broadcast', from.profile.id)
    }
  }

  private checkComplete() {
    if (this.completed) return
    if (this.settled) {
      this.completed = true
      this.emit({ type: 'complete' })
      if (this.announcement?.truth !== undefined && !this.revealing) {
        this.revealing = true
        this.later('outcome', REVEAL_DELAY, () => this.reveal())
      }
    }
  }

  private reveal() {
    const a = this.announcement!
    const outcome = planOutcome(this.sim.content, this.sim.world.places, { ...a, truth: a.truth! })
    this.outcome = outcome
    for (const reaction of this.reactions.values()) {
      if (reaction.isSpeaker || !reaction.decision) continue
      reaction.verdict = judge(reaction.decision, outcome.truth)
      this.emit({ type: 'change', id: reaction.id })
    }
    if (outcome.truth && THREATS.includes(outcome.visual)) react(this.sim, outcome)
    if (!outcome.truth)
      for (const r of this.sim.residents) {
        const action = this.reactions.get(r.profile.id)?.decision?.action
        if (r.mode !== 'inside' && (action === 'go' || action === 'investigate'))
          this.sim.assign(r, [
            { kind: 'wait', seconds: 2.5, label: 'Aquí no hay nada…' },
            { kind: 'enterHome', label: 'Vuelve a casa decepcionado' },
          ])
      }
    this.emit({ type: 'outcome', outcome })
  }
}
