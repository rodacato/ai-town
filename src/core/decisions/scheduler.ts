import { ACTIONS, type Decision, type DecisionContext, type DecisionProvider, type TokenUsage } from './types'

export interface DecisionJob {
  ctx: DecisionContext
  onStart: () => void
  onReasoning: (delta: string) => void
  onRequest?: (system: string, prompt: string) => void
  onResponse?: (text: string, usage?: TokenUsage) => void
  onDecision: (decision: Decision) => void
  onError: (message: string) => void
}

interface Entry {
  job: DecisionJob
  controller: AbortController
}

export class DecisionScheduler {
  private queue: Entry[] = []
  private running = new Set<Entry>()

  constructor(
    public provider: DecisionProvider,
    public concurrency = 6,
    public timeoutMs = 25000,
  ) {}

  /** Changes how many decisions run at once, starting queued ones right away if there is room. */
  setConcurrency(n: number) {
    this.concurrency = n
    this.pump()
  }

  enqueue(job: DecisionJob) {
    const entry = { job, controller: new AbortController() }
    this.queue.push(entry)
    this.pump()
    return () => this.cancel(entry)
  }

  cancelAll() {
    for (const e of [...this.queue, ...this.running]) e.controller.abort()
    this.queue = []
    this.running.clear()
  }

  private cancel(entry: Entry) {
    entry.controller.abort()
    this.queue = this.queue.filter((e) => e !== entry)
    this.running.delete(entry)
  }

  private pump() {
    while (this.running.size < this.concurrency && this.queue.length) {
      const entry = this.queue.shift()!
      this.running.add(entry)
      void this.run(entry).finally(() => {
        this.running.delete(entry)
        this.pump()
      })
    }
  }

  private async run({ job, controller }: Entry) {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(this.timeoutMs)])
    job.onStart()
    try {
      for await (const event of this.provider.decide(job.ctx, signal)) {
        if (controller.signal.aborted) return
        if (event.type === 'reasoning') job.onReasoning(event.delta)
        else if (event.type === 'request') job.onRequest?.(event.system, event.prompt)
        else if (event.type === 'response') job.onResponse?.(event.text, event.usage)
        else return job.onDecision(sanitize(event.decision, job.ctx))
      }
      throw new Error('El modelo terminó sin dar una decisión.')
    } catch (err) {
      if (controller.signal.aborted) return
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
      job.onError(timedOut ? 'Tardó demasiado en decidir.' : err instanceof Error ? err.message : 'Error desconocido.')
    }
  }
}

function sanitize(d: Decision, ctx: DecisionContext): Decision {
  const known = new Set(ctx.townsfolk.map((p) => p.id))
  const action = ACTIONS.includes(d.action) ? d.action : 'ignore'
  const tell = [...new Set((d.tell ?? []).filter((id) => known.has(id) && id !== ctx.resident.id))].slice(0, 3)
  return {
    action: action === 'warn' && !tell.length ? 'ignore' : action,
    believes: d.believes !== false,
    tell,
    reasoning: String(d.reasoning ?? '').trim(),
    speech: String(d.speech ?? '').trim().slice(0, 60),
    emoji: String(d.emoji ?? '').trim() || '💭',
    confidence: Math.min(1, Math.max(0, Number(d.confidence) || 0.5)),
  }
}
