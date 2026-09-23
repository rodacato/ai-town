import { Application, Container } from 'pixi.js'
import type { ReactionEngine } from '../agents/engine'
import { ACTION_META } from '../data/actions'
import type { AnnouncementPlace } from '../sim/announcement'
import type { Simulation } from '../sim/simulation'
import { Birds, Butterflies, CloudShadows, FountainSpray, Smoke, WaterShimmer } from './ambient'
import { drawBuilding } from './buildings'
import { Camera } from './camera'
import { ISLAND_DEPTH, TILE_H, TILE_W, iso } from './iso'
import { drawFountain, drawProp, type PropSprite } from './props'
import { PlaceMarker } from './placeMarker'
import { OriginBeacon, WaveFx } from './reactionFx'
import { ResidentSprite, type ReactionVisual } from './residentSprite'
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
  private swaying: NonNullable<PropSprite['sway']>[] = []
  private flags: Container[] = []
  private smoke: Smoke
  private water: WaterShimmer
  private spray: FountainSpray
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

  static async create(host: HTMLElement, sim: Simulation, engine: ReactionEngine, events: RendererEvents, options: RendererOptions) {
    const app = new Application()
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    })
    return new TownRenderer(app, host, sim, engine, events, options)
  }

  private constructor(
    readonly app: Application,
    host: HTMLElement,
    private sim: Simulation,
    private engine: ReactionEngine,
    private events: RendererEvents,
    options: RendererOptions,
  ) {
    host.appendChild(app.canvas)
    const N = sim.world.size
    const W = sim.world

    this.world.addChild(drawTerrain(W))
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
      const s = drawBuilding(b)
      s.view.zIndex = s.depth
      this.objects.addChild(s.view)
      chimneys.push(...s.chimneys)
      if (s.flag) this.flags.push(s.flag)
    }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const prop = W.tiles[y][x].prop
        if (!prop) continue
        const s = drawProp(prop, x, y)
        if (!s) continue
        s.view.zIndex = s.depth
        this.objects.addChild(s.view)
        if (s.sway) this.swaying.push(s.sway)
      }
    const fountain = drawFountain(W.fountain.x, W.fountain.y, W.fountain.size)
    fountain.view.zIndex = fountain.depth
    this.objects.addChild(fountain.view)
    this.spray = new FountainSpray(fountain.water)

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
    this.world.addChild(this.birds.view, this.overlay)
    this.overlay.addChildAt(this.marker.view, 0)
    this.overlay.sortableChildren = true
    this.beacon = new OriginBeacon(engine)
    this.overlay.addChild(this.beacon.view)
    this.offEngine = engine.on((e) => {
      if (e.type === 'told') {
        this.toldAt.set(e.from, this.time)
        this.rumorAt.set(e.to, this.time)
      }
    })
    app.stage.addChild(this.world)

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

  markPlace(place: AnnouncementPlace | null) {
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
    const g = this.world.toGlobal({ x: p.x, y: p.y - (r.profile.age < 14 ? 33 : 42) })
    return { x: g.x, y: g.y, visible: r.mode !== 'inside' }
  }

  destroy() {
    this.offEngine()
    this.camera.destroy()
    this.app.destroy(true, { children: true })
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
        return { bubble: { kind: 'thinking' }, ring: 0x6fa8c7, pulse: true }
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

  private tick(dt: number) {
    this.time += dt
    const t = this.time
    this.sim.update(dt)
    if (this.engine.announcement && this.announcementAt < 0) this.announcementAt = t
    if (!this.engine.announcement) {
      this.announcementAt = -1
      this.toldAt.clear()
      this.rumorAt.clear()
    }
    const zoom = this.camera.scale
    for (const [id, s] of this.sprites) s.update(t, dt, this.reactionVisual(id), zoom)
    for (const s of this.swaying) s.target.skew.x = Math.sin(t * 1.1 + s.phase) * s.amount + Math.sin(t * 2.3 + s.phase * 2) * s.amount * 0.3
    for (const f of this.flags) f.scale.x = 0.85 + Math.sin(t * 4) * 0.15
    this.water.update(t)
    this.spray.update(t)
    this.smoke.update(dt)
    this.clouds.update(dt)
    this.birds.update(dt, t)
    this.butterflies.update(t)
    this.marker.update(dt)
    this.wave.update(dt)
    this.beacon.update(dt)
    this.camera.update(dt)
  }
}
