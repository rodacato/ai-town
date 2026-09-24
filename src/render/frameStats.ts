import { UPDATE_PRIORITY, type Application, type Container } from 'pixi.js'

/** Rolling timings of the last frames: the whole frame, the town's logic, and Pixi drawing it. */
export interface FrameStats {
  fps: number
  frameP95: number
  logicP50: number
  renderP50: number
  objects: number
}

const WINDOW = 120

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

const countObjects = (c: Container): number => 1 + c.children.reduce((n, child) => n + countObjects(child as Container), 0)

/** Hooks around Pixi's own render step by ticker priority, so nothing is wrapped; the caller logs its logic time. */
export function watchFrames(app: Application) {
  const frames: number[] = []
  const logic: number[] = []
  const render: number[] = []
  const push = (xs: number[], v: number) => {
    xs.push(v)
    if (xs.length > WINDOW) xs.shift()
  }
  let last = performance.now()
  let renderStart = 0
  const beforeRender = () => {
    const now = performance.now()
    push(frames, now - last)
    last = now
    renderStart = now
  }
  const afterRender = () => push(render, performance.now() - renderStart)
  app.ticker.add(beforeRender, null, UPDATE_PRIORITY.LOW + 1)
  app.ticker.add(afterRender, null, UPDATE_PRIORITY.UTILITY)
  return {
    logged: (ms: number) => push(logic, ms),
    read: (): FrameStats => {
      const mean = frames.reduce((n, f) => n + f, 0) / (frames.length || 1)
      return { fps: mean ? 1000 / mean : 0, frameP95: percentile(frames, 0.95), logicP50: percentile(logic, 0.5), renderP50: percentile(render, 0.5), objects: countObjects(app.stage) }
    },
    stop: () => {
      app.ticker.remove(beforeRender, null)
      app.ticker.remove(afterRender, null)
    },
  }
}
