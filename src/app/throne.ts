import { dawnStanding } from '../core/realm/standing'
import { enact, type Decree, type DecreeResult } from '../core/realm/decrees'
import { buildReport, reportText } from '../core/realm/report'
import type { RulerAction } from '../core/realm/ruler'
import type { ChronicleKind, Chronicle } from '../core/realm/chronicle'
import type { TownMemory } from '../core/memory/memory'
import type { Announcement } from '../core/reactions/announcement'
import type { Simulation } from '../core/sim/simulation'
import { clip } from '../core/format'
import { missingKey } from '../providers/llm/config'
import { createModelRuler, createRulesRuler } from '../providers/ruler'
import { useTown } from './store'
import type { Activity, ActivityKind, RulerLog, RulerMode } from './store/reign'

/** What the throne needs from the town around it. */
export interface ThroneHost {
  readonly sim: Simulation
  readonly memory: TownMemory
  readonly chronicle: Chronicle
  /** A new game has begun since this number was read. */
  readonly generation: number
  busy(): boolean
  /** Makes an announcement in the Baroness's name. */
  proclaim(a: Announcement): void
  detectPlace(text: string): string | null
  log(kind: ChronicleKind, text: string, detail?: string): void
  track(kind: ActivityKind, title: string, extra?: Partial<Activity>): number
  settle(id: number, patch: Partial<Activity>): void
  syncRealm(): void
}

/** The Baroness: her decrees, her daily turn with rules or a model, her proclamations and letters, and the guild and mob at dawn. */
export class Throne {
  /** Proclamations waiting for the town to be free; honesty already counted them. */
  queue: { text: string; honest: boolean }[] = []

  constructor(private host: ThroneHost) {}

  stirGuild() {
    useTown.setState((s) => ({ standing: { ...s.standing, plot: 1.15 } }))
    useTown.getState().toast('El gremio de ladrones afila los cuchillos: golpeará al amanecer.')
  }

  /** The guild and the mob take their turn at dawn; the reign may end here. */
  settleStanding(day: number) {
    const e = this.host.sim.economy!
    const standing = structuredClone(useTown.getState().standing)
    const lines = dawnStanding(standing, e, this.host.memory.reputation({ kind: 'authority' }).trust, day)
    useTown.setState({ standing })
    for (const line of lines) {
      this.host.log(standing.end && line === standing.end.text ? 'end' : 'plot', line)
      window.setTimeout(() => useTown.getState().toast(line), 3000)
    }
  }


  /** A ruler's decree: checked, applied, told to the town if it asks, and written in the chronicle. */
  decree(d: Decree, proclaim = true): DecreeResult {
    const e = this.host.sim.economy
    if (!e) return { ok: false, reason: 'Este mundo no tiene economía.', summary: '' }
    const result = enact(e, d)
    const { toast } = useTown.getState()
    if (!result.ok) {
      toast(result.reason!)
      return result
    }
    this.host.log('decree', result.summary)
    toast(result.summary)
    this.host.syncRealm()
    if (proclaim && result.proclamation && !this.host.busy())
      this.host.proclaim({ id: crypto.randomUUID(), text: result.proclamation, speaker: { kind: 'authority' }, place: this.host.detectPlace(result.proclamation), minutes: Math.floor(this.host.sim.minutes), truth: true, official: true })
    return result
  }


  setRulerMode(rulerMode: RulerMode) {
    useTown.setState({ rulerMode })
    if (rulerMode === 'model' && useTown.getState().llm.active === 'mock')
      useTown.getState().toast('No hay un modelo configurado: la Baronesa gobernará con reglas hasta que elijas uno en Configuración.')
  }

  /** The Baroness's turn: read the report, decide, act. Runs at dawn, or on demand from the throne room. */
  async reign(force = false) {
    const state = useTown.getState()
    const e = this.host.sim.economy
    if (!e || state.rulerBusy || (!force && state.rulerMode === 'manual')) return
    const keyless = state.rulerMode === 'model' && missingKey(state.llm, state.envKeys)
    if (keyless) state.toast('La Baronesa gobierna hoy con reglas: falta la key del modelo.')
    const useModel = state.rulerMode === 'model' && state.llm.active !== 'mock' && !keyless
    const modelOk = useModel && state.rulerCalls < state.rulerCap
    if (useModel && !modelOk) state.toast(`La Baronesa llegó al tope de ${state.rulerCap} consultas al modelo en esta partida; gobierna con reglas.`)
    const active = state.llm.active
    const ruler = modelOk && active !== 'mock' ? createModelRuler(state.llm.connections[active]) : createRulesRuler()
    const report = buildReport({ content: this.host.sim.content, economy: e, memory: this.host.memory, chronicle: this.host.chronicle.entries, minutes: this.host.sim.minutes, season: this.host.sim.season, weather: this.host.sim.weather, day: e.day, seed: this.host.sim.content.layout.seed, standing: state.standing })
    useTown.setState({ rulerBusy: true })
    const via = modelOk && active !== 'mock' ? `${state.llm.connections[active].model} (${active})` : 'reglas'
    const entry = this.host.track('ruler', `Día ${e.day + 1}: la Baronesa ${modelOk ? `consulta a ${via}` : 'decide con reglas'}`, { status: modelOk ? 'pending' : 'info', via })
    try {
      const gen = this.host.generation
      const reply = await ruler(report, AbortSignal.timeout(120_000))
      if (gen !== this.host.generation) return
      // A rules ruler cannot word a proclamation of her own, so she announces her first decree.
      let announce = !modelOk
      const actions = reply.actions.map((a) => {
        const done = this.carryOut(a, e.day, announce && a.kind === 'decree')
        if (a.kind === 'decree' && done.ok) announce = false
        return done
      })
      const log: RulerLog = { day: e.day, mode: modelOk ? 'model' : 'rules', thought: reply.thought, report: reply.prompt, response: reply.response, actions, problems: reply.problems, ms: reply.ms, usage: reply.usage }
      useTown.setState((s) => ({
        lastTurn: log,
        rulerCalls: s.rulerCalls + (modelOk ? 1 : 0),
        rulerCost: s.rulerCost + (reply.usage?.costUsd ?? 0),
        history: s.history.map((h) => (h.day === e.day ? { ...h, actions: actions.length, problems: reply.problems.length } : h)),
      }))
      this.host.settle(entry, {
        status: reply.problems.length && !reply.actions.length ? 'error' : 'ok',
        detail: `«${reply.thought || '…'}»${actions.length ? ` → ${actions.map((a) => `${a.ok ? '' : '✗ '}${a.text}`).join(' · ')}` : ' → No hizo nada.'}${reply.problems.length ? ` · Formato: ${reply.problems.join(' ')}` : ''}`,
        ms: modelOk ? Math.round(reply.ms) : undefined,
        costUsd: reply.usage?.costUsd || undefined,
        costEstimated: reply.usage?.costSource === 'table',
        tokensIn: reply.usage?.inputTokens,
        tokensOut: reply.usage?.outputTokens,
      })
      if (reply.actions.length) this.host.log('ruler', `La Baronesa: «${clip(reply.thought, 160)}»`)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'No respondió.'
      this.host.settle(entry, { status: 'error', detail: error })
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
      this.host.log('ruler', `La Baronesa escribe al creador: «${clip(a.text, 120)}»`)
      return { text: `Carta al creador: «${a.text}»`, ok: true }
    }
    useTown.setState((s) => ({ honesty: { proclamations: s.honesty.proclamations + 1, lies: s.honesty.lies + (a.honest ? 0 : 1) } }))
    this.queue.push({ text: a.text, honest: a.honest })
    this.flushProclamations()
    return { text: `Pregón${a.honest ? '' : ' (mentira)'}: «${a.text}»`, ok: true }
  }

  /** The Baroness's proclamations wait their turn if the town is still reacting to something else. */
  flushProclamations() {
    if (this.host.busy()) return
    const next = this.queue.shift()
    if (!next) return
    this.host.proclaim({ id: crypto.randomUUID(), text: next.text, speaker: { kind: 'authority' }, place: this.host.detectPlace(next.text), minutes: Math.floor(this.host.sim.minutes), truth: next.honest, official: true })
  }

  markLettersSeen() {
    useTown.setState((s) => ({ mailbox: s.mailbox.map((l) => ({ ...l, seen: true })) }))
  }
}
