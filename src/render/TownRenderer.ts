import 'pixi.js/unsafe-eval'
import { Application, ColorMatrixFilter, Container, Graphics } from 'pixi.js'
import type { ReactionEngine } from '../core/reactions/engine'
import { ACTION_META } from '../theme/actions'
import type { Simulation } from '../core/sim/simulation'
import { daylight } from '../theme/daylight'
import type { Ambience, Glow, WorldArt } from './art'
import { Birds, Butterflies, CloudShadows, Smoke, WaterShimmer } from './ambient'
import { Camera } from './camera'
import { ISLAND_DEPTH, TILE_H, TILE_W, iso } from './iso'
import type { ArtSprite, PropSprite } from './art'
import { PlaceMarker } from './placeMarker'
import { OriginBeacon, WaveFx } from './reactionFx'
import { ResidentSprite, type ReactionVisual } from './residentSprite'
import { SentrySprite } from './sentrySprite'
import { WEATHER_GRADE, WeatherFx } from './weather'
import type { Outcome } from '../core/reactions/outcome'
import { drawTerrain, islandMask } from './terrain'

export interface RendererEvents {
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}

export interface RendererOptions {
  /** Space covered by floating UI panels, so the camera centers on the visible part of the map. */
  insets: () => { right: number; bottom: number }
}

export class TownRenderer {
  readonly camera: Camera
  private world = new Container()
  private objects = new Container()
  private overlay = new Container()
  private sprites = new Map<string, ResidentSprite>()
  private sentries: SentrySprite[] = []
  private shown = new Map<'outcome' | 'event', { key: Outcome; sprite: ArtSprite }>()
  private godEvent: Outcome | null = null
  private speed = 1
  private weather: WeatherFx
  /** Weather sits outside the world's colour grade, so rain and snow stay bright at night. */
  private weatherLayer = new Container()
  private swaying: NonNullable<PropSprite['sway']>[] = []
  private animated: ((time: number, dt: number, ambience: Ambience) => void)[] = []
  private sky = new ColorMatrixFilter()
  private lights = new Graphics()
  private glows: Glow[] = []
  private ambience: Ambience = { night: 0 }
  /** Honors prefers-reduced-motion: decorative motion freezes and the camera jumps instead of flying. */
  private calm = false
  private calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  private smoke: Smoke
  private water: WaterShimmer
  private clouds: CloudShadows
  private birds: Birds
  private butterflies: Butterflies
  private time = 0
  private hovered: string | null = null
  private highlighted: string | null = null
  private marker = new PlaceMarker()
  private wave: WaveFx
  private beacon: OriginBeacon
  private toldAt = new Map<string, number>()
  private rumorAt = new Map<string, number>()
  private announcementAt = -1
  private offEngine: () => void
  private selected: string | null = null

  static async create(host: HTMLElement, sim: Simulation, engine: ReactionEngine, art: WorldArt, events: RendererEvents, options: RendererOptions) {
    const app = new Application()
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    })
    return new TownRenderer(app, host, sim, engine, art, events, options)
  }

  private constructor(
    readonly app: Application,
    host: HTMLElement,
    private sim: Simulation,
    private engine: ReactionEngine,
    private art: WorldArt,
    private events: RendererEvents,
    options: RendererOptions,
  ) {
    host.appendChild(app.canvas)
    const N = sim.world.size
    const W = sim.world

    this.world.addChild(drawTerrain(W, art.terrain))
    this.water = new WaterShimmer(W)
    this.world.addChild(this.water.view)
    this.wave = new WaveFx(engine)
    const waveMask = islandMask(N)
    this.world.addChild(waveMask, this.wave.view)
    this.wave.view.mask = waveMask

    this.objects.sortableChildren = true
    this.world.addChild(this.objects)

    const chimneys: { x: number; y: number }[] = []
    for (const b of W.buildings) {
      const s = art.building(b)
      s.view.zIndex = s.depth
      this.objects.addChild(s.view)
      chimneys.push(...s.chimneys)
      if (s.update) this.animated.push(s.update)
      if (s.glows) this.glows.push(...s.glows)
    }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const prop = W.tiles[y][x].prop
        if (!prop) continue
        const s = art.prop(prop, x, y)
        if (!s) continue
        s.view.zIndex = s.depth
        this.objects.addChild(s.view)
        if (s.sway) this.swaying.push(s.sway)
        if (s.update) this.animated.push(s.update)
        if (s.glows) this.glows.push(...s.glows)
      }
    for (const l of W.landmarks) {
      const s = art.landmark(l)
      s.view.zIndex = s.depth
      this.objects.addChild(s.view)
      if (s.update) this.animated.push(s.update)
      if (s.glows) this.glows.push(...s.glows)
    }
    for (const glow of this.glows)
      for (const [k, a] of [
        [1, 0.05],
        [0.62, 0.08],
        [0.3, 0.14],
      ])
        this.lights.circle(glow.x, glow.y, glow.r * k).fill({ color: glow.color, alpha: a })

    for (const r of sim.residents) {
      const sprite = new ResidentSprite(r, this.overlay)
      const id = r.profile.id
      sprite.view.on('pointerover', () => this.setHover(id))
      sprite.view.on('pointerout', () => this.hovered === id && this.setHover(null))
      sprite.view.on('pointertap', () => {
        if (!this.camera.wasDrag) this.select(id)
      })
      this.sprites.set(id, sprite)
      this.objects.addChild(sprite.view)
    }

    for (const s of W.sentries) {
      const sprite = new SentrySprite(s)
      this.sentries.push(sprite)
      this.objects.addChild(sprite.view)
    }

    this.butterflies = new Butterflies(W)
    this.objects.addChild(this.butterflies.view)
    this.butterflies.view.zIndex = 1e6
    this.smoke = new Smoke(chimneys)
    this.world.addChild(this.smoke.view)
    const span = N * (TILE_W / 2)
    this.clouds = new CloudShadows(span)
    const mask = islandMask(N)
    this.world.addChild(mask, this.clouds.view)
    this.clouds.view.mask = mask
    this.birds = new Birds(span)
    this.weather = new WeatherFx(span, N * TILE_H)
    const weatherMask = islandMask(N)
    this.weatherLayer.addChild(this.weather.view, weatherMask)
    this.weather.view.mask = weatherMask
    this.world.addChild(this.birds.view, this.overlay)
    this.overlay.addChildAt(this.marker.view, 0)
    this.overlay.sortableChildren = true
    this.beacon = new OriginBeacon(engine, art.stranger())
    this.overlay.addChild(this.beacon.view)
    this.offEngine = engine.on((e) => {
      if (e.type === 'told') {
        this.toldAt.set(e.from, this.time)
        this.rumorAt.set(e.to, this.time)
      }
    })
    app.stage.addChild(this.world, this.lights, this.weatherLayer, this.weather.flash)
    this.lights.blendMode = 'add'
    this.lights.eventMode = 'none'
    this.calm = this.calmQuery.matches
    this.calmQuery.addEventListener('change', this.onCalmChange)

    app.stage.eventMode = 'static'
    app.stage.hitArea = app.screen
    app.stage.on('pointertap', (e) => {
      if (e.target === app.stage && !this.camera.wasDrag) this.select(null)
    })

    const bounds = { x: -span - 20, y: -130, w: span * 2 + 40, h: N * TILE_H + ISLAND_DEPTH + 170 }
    this.camera = new Camera(this.world, app.canvas, bounds, () => ({
      w: app.screen.width,
      h: app.screen.height,
      ...options.insets(),
    }))
    this.camera.instant = this.calm
    this.camera.fit(false)
    app.renderer.on('resize', () => this.camera.handleResize())

    app.ticker.add((t) => this.tick(Math.min(t.deltaMS / 1000, 0.05)))
  }

  select(id: string | null) {
    if (this.selected) this.sprites.get(this.selected)!.selected = false
    this.selected = id
    if (id) {
      this.sprites.get(id)!.selected = true
      const r = this.sim.get(id)!
      this.camera.follow(() => iso(r.x, r.y, 20))
    } else this.camera.unfollow()
    this.events.onSelect(id)
  }

  /** Highlights a resident from outside the map, e.g. when hovering their avatar in a panel. */
  highlight(id: string | null) {
    if (this.highlighted && this.highlighted !== this.hovered) this.sprites.get(this.highlighted)!.hovered = false
    this.highlighted = id
    if (id) this.sprites.get(id)!.hovered = true
  }

  markPlace(place: string | null) {
    const spots = place && place !== 'home' ? this.sim.world.places.find((p) => p.id === place)?.spots : undefined
    if (!spots?.length) return this.marker.show(null)
    const cx = spots.reduce((s, p) => s + p.x, 0) / spots.length
    const cy = spots.reduce((s, p) => s + p.y, 0) / spots.length
    const nearest = spots.reduce((a, b) => (Math.hypot(a.x - cx, a.y - cy) <= Math.hypot(b.x - cx, b.y - cy) ? a : b))
    this.marker.show(iso(nearest.x + 0.5, nearest.y + 0.5))
  }

  /** Screen position (CSS px, relative to the canvas) of a point just above a resident's head. */
  residentScreenPosition(id: string) {
    const r = this.sim.get(id)
    if (!r) return null
    const p = iso(r.x, r.y)
    const g = this.world.toGlobal({ x: p.x, y: p.y - this.sprites.get(id)!.headHeight - 4 })
    return { x: g.x, y: g.y, visible: r.mode !== 'inside' }
  }

  destroy() {
    this.calmQuery.removeEventListener('change', this.onCalmChange)
    this.offEngine()
    this.camera.destroy()
    this.app.destroy(true, { children: true })
  }

  private onCalmChange = (e: MediaQueryListEvent) => {
    this.calm = e.matches
    this.camera.instant = e.matches
  }

  private updateSky() {
    const sky = daylight(this.sim.minutes)
    this.ambience.night = sky.night
    this.lights.position.copyFrom(this.world.position)
    this.lights.scale.copyFrom(this.world.scale)
    this.weatherLayer.position.copyFrom(this.world.position)
    this.weatherLayer.scale.copyFrom(this.world.scale)
    this.lights.alpha = Math.max(0, sky.night - 0.15) * (1 + Math.sin(this.time * 3) * 0.04)
    this.lights.visible = this.lights.alpha > 0.01
    const grade = WEATHER_GRADE[this.sim.weather]
    const tinted = sky.alpha > 0.005 || this.sim.weather !== 'clear'
    if (tinted) {
      const k = (shift: number) => 1 - sky.alpha + sky.alpha * (((sky.tint >> shift) & 255) / 255)
      const [r, g, b] = [k(16) * grade[0][0], k(8) * grade[1][0], k(0) * grade[2][0]]
      this.sky.matrix = [r, 0, 0, 0, grade[0][1], 0, g, 0, 0, grade[1][1], 0, 0, b, 0, grade[2][1], 0, 0, 0, 1, 0]
    }
    if (tinted !== !!this.world.filters?.length) this.world.filters = tinted ? [this.sky] : []
  }

  /** Pushes overlapping speech bubbles upward so simultaneous reactions stay readable. */
  private spreadBubbles() {
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
    const bubbles = [...this.sprites.values()].map((s) => s.reactionBubble).filter((b) => b.box)
    bubbles.sort((a, b) => b.view.y - a.view.y)
    for (const b of bubbles) {
      const box = b.box!
      const s = b.view.scale.x
      const r = { x0: b.view.x + box.x0 * s, x1: b.view.x + box.x1 * s, y0: b.view.y + box.y0 * s, y1: b.view.y + box.y1 * s }
      for (let guard = 0; guard < 12; guard++) {
        const hit = placed.find((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0)
        if (!hit) break
        const dy = r.y1 - hit.y0 + 3
        r.y0 -= dy
        r.y1 -= dy
        b.view.y -= dy
      }
      placed.push(r)
    }
  }

  private reactionVisual(id: string): ReactionVisual | undefined {
    const rx = this.engine.reactions.get(id)
    if (!rx) return undefined
    const t = this.time
    const d = rx.decision
    const meta = d ? ACTION_META[d.action] : null
    const ring = meta?.color ?? null
    if (rx.isSpeaker) return { bubble: t - this.announcementAt < 5 ? { kind: 'megaphone' } : { kind: 'none' }, ring: null, pulse: false }
    const told = this.toldAt.get(id)
    if (d && told !== undefined && t - told < 2.6) return { bubble: { kind: 'speech', emoji: d.emoji, text: d.speech, color: ring! }, ring, pulse: false }
    const rumor = this.rumorAt.get(id)
    if (rumor !== undefined && t - rumor < 1.2) return { bubble: { kind: 'alert' }, ring, pulse: false }
    switch (rx.phase) {
      case 'heard':
        return { bubble: { kind: 'alert' }, ring, pulse: false }
      case 'thinking':
        return rx.startedAt === null ? { bubble: { kind: 'thinking' }, ring: 0xb9b0a4, pulse: false } : { bubble: { kind: 'thinking' }, ring: 0x6fa8c7, pulse: true }
      case 'error':
        return { bubble: { kind: 'error' }, ring: 0xc8645a, pulse: false }
      case 'decided': {
        if (!d) return undefined
        const since = (performance.now() - (rx.decidedAt ?? 0)) / 1000
        return {
          bubble: since < 4.2 ? { kind: 'speech', emoji: d.emoji, text: d.speech, color: ring! } : { kind: 'badge', emoji: d.emoji, color: ring! },
          ring,
          pulse: false,
        }
      }
      default:
        return undefined
    }
  }

  private setHover(id: string | null) {
    if (this.hovered) this.sprites.get(this.hovered)!.hovered = false
    this.hovered = id
    if (id) this.sprites.get(id)!.hovered = true
    this.events.onHover(id)
  }

  /** Runs the town faster, slower, or not at all (0); model requests are unaffected. */
  setSpeed(speed: number) {
    this.speed = speed
  }

  /** An event from the god panel, drawn alongside any announcement's outcome. */
  showEvent(event: Outcome | null) {
    this.godEvent = event
  }

  /** Keeps the announcement's revealed outcome and the god panel's event on the map, and clears them on reset. */
  private syncOutcomes(t: number, dt: number) {
    for (const [slot, o] of [
      ['outcome', this.engine.outcome],
      ['event', this.godEvent],
    ] as const) {
      const current = this.shown.get(slot)
      if (current?.key !== o) {
        current?.sprite.view.destroy({ children: true })
        this.shown.delete(slot)
        const sprite = o && this.art.outcome?.(o)
        if (sprite) {
          sprite.view.zIndex = sprite.depth
          this.objects.addChild(sprite.view)
          this.shown.set(slot, { key: o, sprite })
        }
      }
      const shown = this.shown.get(slot)
      if (!shown) continue
      if (this.calm) shown.sprite.view.scale.set(1)
      else shown.sprite.update?.(t, dt, this.ambience)
    }
  }

  private tick(dt: number) {
    this.time += dt
    const t = this.time
    this.sim.update(dt * this.speed)
    if (this.engine.announcement && this.announcementAt < 0) this.announcementAt = t
    if (!this.engine.announcement) {
      this.announcementAt = -1
      this.toldAt.clear()
      this.rumorAt.clear()
    }
    const zoom = this.camera.scale
    for (const [id, s] of this.sprites) s.update(t, dt, this.reactionVisual(id), zoom)
    if (!this.calm) for (const s of this.sentries) s.update(t)
    this.syncOutcomes(t, dt)
    this.weather.set(this.sim.weather)
    this.weather.update(dt, t, this.app.screen, this.calm)
    this.spreadBubbles()
    this.updateSky()
    if (!this.calm) {
      for (const s of this.swaying) s.target.skew.x = Math.sin(t * 1.1 + s.phase) * s.amount + Math.sin(t * 2.3 + s.phase * 2) * s.amount * 0.3
      for (const update of this.animated) update(t, dt, this.ambience)
      this.water.update(t)
      this.smoke.update(dt)
      this.clouds.update(dt)
      this.birds.update(dt, t)
      this.butterflies.update(t)
    }
    this.marker.update(dt)
    this.wave.update(dt)
    this.beacon.update(dt)
    this.camera.update(dt)
  }
}
