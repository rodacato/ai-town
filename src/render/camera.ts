import type { Container } from 'pixi.js'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Flight {
  from: { x: number; y: number; scale: number }
  to: { x: number; y: number; scale: number }
  t: number
  duration: number
}

const MIN_ZOOM = 0.45
const MAX_ZOOM = 2.8
const MAX_FLING = 1200
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clampZoom = (s: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s))

export class Camera {
  private targetScale = 1
  private anchor: { screen: { x: number; y: number }; world: { x: number; y: number } } | null = null
  private velocity = { x: 0, y: 0 }
  private drag: { id: number; last: { x: number; y: number }; start: { x: number; y: number }; t: number } | null = null
  private flight: Flight | null = null
  private following: (() => { x: number; y: number }) | null = null
  private moved = false
  private listeners: [string, EventListener][] = []
  onInteract?: () => void

  constructor(
    private view: Container,
    private el: HTMLElement,
    private bounds: Rect,
    private viewport: () => { w: number; h: number; insetRight: number },
  ) {
    this.on('pointerdown', (e) => this.pointerDown(e as PointerEvent))
    this.on('pointermove', (e) => this.pointerMove(e as PointerEvent))
    this.on('pointerup', (e) => this.pointerUp(e as PointerEvent))
    this.on('pointercancel', (e) => this.pointerUp(e as PointerEvent))
    this.on('wheel', (e) => this.wheel(e as WheelEvent))
  }

  get scale() {
    return this.view.scale.x
  }

  /** True if the last pointer gesture was a drag, so clicks on residents should be ignored. */
  get wasDrag() {
    return this.moved
  }

  fit(animate = true) {
    const { w, h, insetRight } = this.viewport()
    const pad = 48
    const scale = clampZoom(Math.min((w - insetRight - pad * 2) / this.bounds.w, (h - pad * 2 - 40) / this.bounds.h) * 1.08)
    const cx = this.bounds.x + this.bounds.w / 2
    const cy = this.bounds.y + this.bounds.h / 2
    const target = { scale, x: (w - insetRight) / 2 - cx * scale, y: h / 2 + 20 - cy * scale }
    if (!animate) {
      this.view.scale.set(scale)
      this.view.position.set(target.x, target.y)
      this.targetScale = scale
      return
    }
    this.following = null
    this.flyTo(target, 0.9)
  }

  /** Fly to a moving world point and keep it centered until the user takes over the camera. */
  follow(target: () => { x: number; y: number }, minScale = 1.5) {
    const scale = clampZoom(Math.max(this.targetScale, minScale))
    const screen = this.focusPoint()
    const p = target()
    this.flyTo({ scale, x: screen.x - p.x * scale, y: screen.y - p.y * scale }, 0.8)
    this.following = target
  }

  unfollow() {
    this.following = null
  }

  zoomBy(factor: number, around?: { x: number; y: number }) {
    const { w, h, insetRight } = this.viewport()
    const screen = around ?? (this.following ? this.focusPoint() : { x: (w - insetRight) / 2, y: h / 2 })
    if (around) this.following = null
    this.flight = null
    this.targetScale = clampZoom(this.targetScale * factor)
    this.anchor = { screen, world: this.toWorld(screen) }
  }

  update(dt: number) {
    const v = this.view
    if (this.flight) {
      const f = this.flight
      f.t = Math.min(1, f.t + dt / f.duration)
      const k = easeInOut(f.t)
      v.scale.set(f.from.scale + (f.to.scale - f.from.scale) * k)
      v.position.set(f.from.x + (f.to.x - f.from.x) * k, f.from.y + (f.to.y - f.from.y) * k)
      if (f.t >= 1) {
        this.flight = null
        this.targetScale = f.to.scale
      }
      return
    }
    if (this.anchor) {
      const s = v.scale.x + (this.targetScale - v.scale.x) * Math.min(1, dt * 12)
      v.scale.set(s)
      v.position.set(this.anchor.screen.x - this.anchor.world.x * s, this.anchor.screen.y - this.anchor.world.y * s)
      if (Math.abs(s - this.targetScale) < 0.0005) this.anchor = null
    }
    if (this.following && !this.drag && !this.anchor) {
      const p = this.following()
      const screen = this.focusPoint()
      const k = Math.min(1, dt * 4)
      v.position.set(v.x + (screen.x - p.x * v.scale.x - v.x) * k, v.y + (screen.y - p.y * v.scale.y - v.y) * k)
      return
    }
    if (!this.drag) {
      v.position.x += this.velocity.x * dt
      v.position.y += this.velocity.y * dt
      const decay = Math.pow(0.002, dt)
      this.velocity.x *= decay
      this.velocity.y *= decay
      this.softClamp(dt)
    }
  }

  destroy() {
    for (const [type, fn] of this.listeners) this.el.removeEventListener(type, fn)
  }

  private on(type: string, fn: EventListener) {
    this.el.addEventListener(type, fn, { passive: false })
    this.listeners.push([type, fn])
  }

  private flyTo(to: Flight['to'], duration: number) {
    this.anchor = null
    this.velocity = { x: 0, y: 0 }
    this.flight = { from: { x: this.view.x, y: this.view.y, scale: this.view.scale.x }, to, t: 0, duration }
  }

  private focusPoint() {
    const { w, h, insetRight } = this.viewport()
    return { x: (w - insetRight) / 2, y: h / 2 + 20 }
  }

  private toWorld(p: { x: number; y: number }) {
    return { x: (p.x - this.view.x) / this.view.scale.x, y: (p.y - this.view.y) / this.view.scale.y }
  }

  private local(e: PointerEvent | WheelEvent) {
    const r = this.el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private pointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    const p = this.local(e)
    this.drag = { id: e.pointerId, last: p, start: p, t: performance.now() }
    this.moved = false
    this.flight = null
    this.anchor = null
    this.velocity = { x: 0, y: 0 }
  }

  private pointerMove(e: PointerEvent) {
    if (!this.drag || e.pointerId !== this.drag.id) return
    const p = this.local(e)
    if (!this.moved && Math.hypot(p.x - this.drag.start.x, p.y - this.drag.start.y) > 5) {
      this.moved = true
      this.following = null
      this.el.setPointerCapture(e.pointerId)
      this.el.style.cursor = 'grabbing'
      this.onInteract?.()
    }
    if (!this.moved) return
    const now = performance.now()
    const dx = p.x - this.drag.last.x
    const dy = p.y - this.drag.last.y
    this.view.position.x += dx
    this.view.position.y += dy
    const dts = Math.max(16, now - this.drag.t) / 1000
    const vx = this.velocity.x * 0.6 + (dx / dts) * 0.4
    const vy = this.velocity.y * 0.6 + (dy / dts) * 0.4
    const speed = Math.hypot(vx, vy)
    const k = speed > MAX_FLING ? MAX_FLING / speed : 1
    this.velocity = { x: vx * k, y: vy * k }
    this.drag.last = p
    this.drag.t = now
  }

  private pointerUp(e: PointerEvent) {
    if (!this.drag || e.pointerId !== this.drag.id) return
    if (performance.now() - this.drag.t > 80) this.velocity = { x: 0, y: 0 }
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId)
    this.el.style.cursor = ''
    this.drag = null
  }

  private wheel(e: WheelEvent) {
    e.preventDefault()
    const speed = e.ctrlKey ? 0.012 : e.deltaMode === 1 ? 0.05 : 0.0018
    this.zoomBy(Math.exp(-e.deltaY * speed), this.local(e))
    this.onInteract?.()
  }

  private softClamp(dt: number) {
    const { w, h } = this.viewport()
    const s = this.view.scale.x
    const margin = 160
    const minX = margin - (this.bounds.x + this.bounds.w) * s
    const maxX = w - margin - this.bounds.x * s
    const minY = margin - (this.bounds.y + this.bounds.h) * s
    const maxY = h - margin - this.bounds.y * s
    const pull = Math.min(1, dt * 8)
    const v = this.view.position
    const outX = v.x < minX || v.x > maxX
    const outY = v.y < minY || v.y > maxY
    if (outX) {
      v.x += ((v.x < minX ? minX : maxX) - v.x) * pull
      this.velocity.x = 0
    }
    if (outY) {
      v.y += ((v.y < minY ? minY : maxY) - v.y) * pull
      this.velocity.y = 0
    }
  }
}
