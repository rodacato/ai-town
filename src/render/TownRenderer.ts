import { Application, Container } from 'pixi.js'
import type { Simulation } from '../sim/simulation'
import { Birds, Butterflies, CloudShadows, FountainSpray, Smoke, WaterShimmer } from './ambient'
import { drawBuilding } from './buildings'
import { Camera } from './camera'
import { ISLAND_DEPTH, TILE_H, TILE_W, iso } from './iso'
import { drawFountain, drawProp, type PropSprite } from './props'
import { ResidentSprite } from './residentSprite'
import { drawTerrain, islandMask } from './terrain'

export interface RendererEvents {
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}

export interface RendererOptions {
  /** Width of UI panels floating over the right edge, so the camera centers on the visible map. */
  insetRight: () => number
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
  private selected: string | null = null

  static async create(host: HTMLElement, sim: Simulation, events: RendererEvents, options: RendererOptions) {
    const app = new Application()
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    })
    return new TownRenderer(app, host, sim, events, options)
  }

  private constructor(
    readonly app: Application,
    host: HTMLElement,
    private sim: Simulation,
    private events: RendererEvents,
    options: RendererOptions,
  ) {
    host.appendChild(app.canvas)
    const N = sim.world.size
    const W = sim.world

    this.world.addChild(drawTerrain(W))
    this.water = new WaterShimmer(W)
    this.world.addChild(this.water.view)

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
      insetRight: options.insetRight(),
    }))
    this.camera.fit(false)

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

  /** Screen position (CSS px, relative to the canvas) of a point just above a resident's head. */
  residentScreenPosition(id: string) {
    const r = this.sim.get(id)
    if (!r) return null
    const p = iso(r.x, r.y)
    const g = this.world.toGlobal({ x: p.x, y: p.y - (r.profile.age < 14 ? 33 : 42) })
    return { x: g.x, y: g.y, visible: r.mode !== 'inside' }
  }

  destroy() {
    this.camera.destroy()
    this.app.destroy(true, { children: true })
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
    for (const s of this.sprites.values()) s.update(t, dt)
    for (const s of this.swaying) s.target.skew.x = Math.sin(t * 1.1 + s.phase) * s.amount + Math.sin(t * 2.3 + s.phase * 2) * s.amount * 0.3
    for (const f of this.flags) f.scale.x = 0.85 + Math.sin(t * 4) * 0.15
    this.water.update(t)
    this.spray.update(t)
    this.smoke.update(dt)
    this.clouds.update(dt)
    this.birds.update(dt, t)
    this.butterflies.update(t)
    this.camera.update(dt)
  }
}
