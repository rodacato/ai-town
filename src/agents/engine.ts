import { PLACE_LABEL, toPlace } from '../data/announcements'
import type { Announcement } from '../sim/announcement'
import type { Resident, Simulation, Task } from '../sim/simulation'
import type { Point } from '../sim/types'
import { buildContext } from './context'
import type { DecisionScheduler } from './scheduler'
import type { Decision, Rumor } from './types'

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
  reasoning: string
  decision: Decision | null
  previous: Decision | null
  revisedBy: string | null
  rumors: Rumor[]
  told: string[]
  error: string | null
}

export type EngineEvent =
  | { type: 'change'; id: string }
  | { type: 'told'; from: string; to: string }
  | { type: 'complete' }

const WAVE_SPEED = 6
const HEAR_PAUSE = 0.7
const SPEECH_PAUSE = 1.4
const INDOOR_DELAY = 0.6

const first = (name: string) => name.split(' ')[0]

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
    this.origin = this.originFor(a)
    this.waveRadius = 0
    this.waveMax = Math.max(...this.sim.residents.map((r) => Math.hypot(r.x - this.origin.x, r.y - this.origin.y))) + INDOOR_DELAY * WAVE_SPEED
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
    this.waveRadius = 0
  }

  retry(id: string) {
    const reaction = this.reactions.get(id)
    if (reaction?.phase !== 'error') return
    this.request(this.sim.get(id)!, reaction)
  }

  get settled() {
    const all = [...this.reactions.values()].filter((r) => !r.isSpeaker)
    return all.length > 0 && all.every((r) => r.phase === 'decided' || r.phase === 'error')
  }

  private emit(e: EngineEvent) {
    for (const fn of this.listeners) fn(e)
  }

  private later(id: string, seconds: number, run: () => void) {
    this.timers.set(`${id}:${++this.timerSeq}`, { at: this.clock + seconds, run })
  }

  private originFor(a: Announcement): Point {
    if (a.speaker.kind === 'neighbor') {
      const r = this.sim.get(a.speaker.residentId!)
      if (r) return r.mode === 'inside' ? { x: this.sim.homeDoor(r).x + 0.5, y: this.sim.homeDoor(r).y + 0.5 } : { x: r.x, y: r.y }
    }
    if (a.speaker.kind === 'mayor') {
      const d = this.sim.world.buildings.find((b) => b.id === 'townhall')!.door
      return { x: d.x + 0.5, y: d.y + 0.5 }
    }
    return { x: 13.5, y: 18.5 }
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
      for (const r of this.sim.residents) {
        const reaction = this.reactions.get(r.profile.id)!
        if (reaction.phase !== 'unaware') continue
        const d = Math.hypot(r.x - this.origin.x, r.y - this.origin.y) + (r.mode === 'inside' ? INDOOR_DELAY * WAVE_SPEED : 0)
        if (d <= this.waveRadius) this.hear(r, reaction, 'broadcast')
      }
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
    r.frozen = true
    this.emit({ type: 'change', id: reaction.id })
    const ctx = buildContext(a, r, this.sim.minutes, reaction.rumors, reaction.decision)
    this.scheduler.enqueue({
      ctx,
      onStart: () => {
        reaction.startedAt = performance.now()
        this.emit({ type: 'change', id: reaction.id })
      },
      onReasoning: (delta) => {
        reaction.reasoning += delta
        this.emit({ type: 'change', id: reaction.id })
      },
      onDecision: (decision) => this.decided(r, reaction, decision),
      onError: (message) => {
        reaction.phase = 'error'
        reaction.error = message
        r.frozen = false
        this.emit({ type: 'change', id: reaction.id })
        this.checkComplete()
      },
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
    reaction.phase = 'decided'
    reaction.decidedAt = performance.now()
    reaction.latencyMs = reaction.decidedAt - (reaction.startedAt ?? reaction.decidedAt)
    this.emit({ type: 'change', id: reaction.id })
    this.later(reaction.id, SPEECH_PAUSE, () => {
      r.frozen = false
      if (!previous || changed) this.act(r, reaction, decision)
    })
    this.checkComplete()
  }

  private act(r: Resident, reaction: Reaction, d: Decision) {
    const a = this.announcement!
    const placeId = a.place && a.place !== 'home' ? a.place : 'plaza'
    const placeLabel = PLACE_LABEL[placeId]
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
    }
  }
}
