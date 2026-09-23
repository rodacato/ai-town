import { Container, Graphics, Rectangle } from 'pixi.js'
import type { Look } from '../core/world/content'
import type { Resident } from '../core/sim/simulation'
import { Bubble, type BubbleState } from './bubble'
import { iso } from './iso'
import { PAL, shade } from './palette'

export interface ReactionVisual {
  bubble: BubbleState
  ring: number | null
  pulse: boolean
}

const NO_REACTION: ReactionVisual = { bubble: { kind: 'none' }, ring: null, pulse: false }

export class ResidentSprite {
  readonly view = new Container()
  private stateRing = new Graphics()
  private reaction = new Bubble()
  private body = new Container()
  private legL = new Graphics()
  private legR = new Graphics()
  private armL = new Graphics()
  private armR = new Graphics()
  private ring = new Graphics()
  private bubble = new Container()
  private dots: Graphics[] = []
  private alpha = 1
  private bubbleOffset = 0
  hovered = false
  selected = false

  constructor(
    readonly resident: Resident,
    private overlay: Container,
  ) {
    const { look, age } = resident.profile
    const scale = age < 14 ? 0.85 : 1.1
    this.view.eventMode = 'static'
    this.view.cursor = 'pointer'
    this.view.hitArea = new Rectangle(-11, -36, 22, 40)

    this.ring.ellipse(0, 0, 13, 6.5).stroke({ width: 2.5, color: PAL.accent, alpha: 0.9 })
    this.ring.ellipse(0, 0, 13, 6.5).fill({ color: PAL.accent, alpha: 0.15 })
    this.ring.visible = false
    this.stateRing.ellipse(0, 0, 11, 5.5).stroke({ width: 2.5, color: 0xffffff })
    this.stateRing.ellipse(0, 0, 11, 5.5).fill({ color: 0xffffff, alpha: 0.2 })
    this.stateRing.visible = false
    this.view.addChild(this.stateRing, this.ring)

    const shadow = new Graphics().ellipse(0, 0, 7.5 * scale, 3.4 * scale).fill({ color: PAL.shadow, alpha: 0.2 })
    this.view.addChild(shadow)

    this.body.scale.set(scale)
    this.view.addChild(this.body)
    for (const [leg, lx] of [
      [this.legL, -3.4],
      [this.legR, 0.6],
    ] as const) {
      leg.roundRect(0, -8, 2.8, 8, 1.2).fill(look.pants)
      leg.roundRect(-0.2, -1.6, 3.4, 1.8, 0.8).fill(shade(look.pants, -0.45))
      leg.x = lx
      this.body.addChild(leg)
    }
    this.armL.roundRect(-1.3, 0, 2.6, 8, 1.3).fill(shade(look.shirt, -0.12))
    this.armL.position.set(-5.6, -17)
    this.body.addChild(this.armL)
    this.body.addChild(drawTorso(look))
    this.armR.roundRect(-1.3, 0, 2.6, 8, 1.3).fill(look.shirt)
    this.armR.circle(0, 8, 1.5).fill(look.skin)
    this.armR.position.set(5.6, -17)
    this.body.addChild(this.armR)
    this.body.addChild(drawHead(look, age))

    this.buildBubble(scale)
  }

  private buildBubble(scale: number) {
    const g = new Graphics()
    g.roundRect(-13, -9, 26, 15, 7.5).fill(0xffffff).stroke({ width: 1, color: 0xe6ddd0 })
    g.poly([-3, 5, 2, 5, -4, 10]).fill(0xffffff)
    this.bubble.addChild(g)
    for (let i = 0; i < 3; i++) {
      const d = new Graphics().circle(0, 0, 1.8).fill(PAL.ink)
      d.position.set(-6 + i * 6, -1.5)
      this.dots.push(d)
      this.bubble.addChild(d)
    }
    this.bubbleOffset = -40 * scale
    this.bubble.visible = false
    this.overlay.addChild(this.bubble, this.reaction.view)
  }

  update(time: number, dt: number, reaction: ReactionVisual = NO_REACTION, zoom = 1) {
    const r = this.resident
    const p = iso(r.x, r.y)
    this.view.position.set(p.x, p.y)
    this.view.zIndex = r.x + r.y

    const target = r.mode === 'inside' ? 0 : 1
    this.alpha += (target - this.alpha) * Math.min(1, dt * 8)
    this.view.alpha = this.alpha
    this.view.visible = this.alpha > 0.02
    this.view.eventMode = r.mode === 'inside' ? 'none' : 'static'

    this.body.scale.x = Math.abs(this.body.scale.x) * r.facing
    const walking = r.mode === 'walking'
    const s = Math.sin(r.walkPhase)
    this.legL.y = walking ? Math.max(0, s) * -2 : 0
    this.legR.y = walking ? Math.max(0, -s) * -2 : 0
    this.armL.rotation = walking ? s * 0.5 : Math.sin(time * 1.3 + r.walkPhase) * 0.04
    this.armR.rotation = walking ? -s * 0.5 : -Math.sin(time * 1.3 + r.walkPhase) * 0.04
    this.body.y = walking ? -Math.abs(Math.cos(r.walkPhase)) * 1.4 : Math.sin(time * 2 + r.walkPhase) * 0.3

    const showReaction = reaction.bubble.kind !== 'none' && r.mode !== 'inside'
    this.reaction.update(showReaction ? reaction.bubble : { kind: 'none' }, p.x, p.y + this.bubbleOffset + 4, time, dt, zoom)
    this.stateRing.visible = reaction.ring !== null
    if (reaction.ring !== null) {
      this.stateRing.tint = reaction.ring
      const k = reaction.pulse ? 1 + Math.sin(time * 6) * 0.12 : 1
      this.stateRing.scale.set(k)
      this.stateRing.alpha = reaction.pulse ? 0.9 : 0.75
    }
    this.bubble.visible = !!r.chatting && r.mode === 'idle' && !showReaction
    this.bubble.position.set(p.x + 9, p.y + this.bubbleOffset)
    if (this.bubble.visible) this.dots.forEach((d, i) => (d.y = -1.5 + Math.sin(time * 6 - i * 0.8) * 1.3))

    this.ring.visible = this.hovered || this.selected
    const k = this.hovered ? 1.08 : 1
    this.view.scale.set(this.view.scale.x + (k - this.view.scale.x) * Math.min(1, dt * 14))
  }
}

function drawTorso(look: Look) {
  const g = new Graphics()
  g.roundRect(-5.8, -18, 11.6, 11.5, 4).fill(look.shirt)
  g.roundRect(-5.8, -9.5, 11.6, 3, 1.5).fill(shade(look.shirt, -0.15))
  if (look.accessory === 'apron') g.roundRect(-4.2, -15, 8.4, 9.5, 2).fill(0xfbf6ee)
  if (look.accessory === 'scarf') g.roundRect(-5, -19, 10, 3.2, 1.6).fill(0xe8c170)
  if (look.accessory === 'bag') {
    g.moveTo(-5, -17).lineTo(4, -9).stroke({ width: 1.3, color: 0x6b4a33 })
    g.roundRect(2, -10.5, 6, 5, 1.5).fill(0x8a5f40)
  }
  if (look.accessory === 'cane') g.moveTo(8, -9).lineTo(9, 0).stroke({ width: 1.4, color: 0x6b4a33, cap: 'round' })
  return g
}

function drawHead(look: Look, age: number) {
  const g = new Graphics()
  const hy = -23.5
  const hair = look.hair
  if (look.hairStyle === 'long') g.roundRect(-5.8, hy, 4.6, 9, 2).fill(shade(hair, -0.12))
  g.rect(-1.6, -19.5, 3.2, 2.5).fill(shade(look.skin, -0.1))
  g.circle(0, hy, 5.2).fill(look.skin)
  g.circle(3.3, hy + 1.8, 1.1).fill({ color: 0xe88b7a, alpha: 0.35 })
  g.circle(2.5, hy + 0.6, 0.85).fill(PAL.ink)
  if (age >= 60) g.moveTo(1.5, hy + 2.8).lineTo(3.4, hy + 2.6).stroke({ width: 0.6, color: shade(look.skin, -0.3) })

  const cap = () => g.poly(arcPoints(0, hy, 5.6, Math.PI * 0.98, Math.PI * 1.9)).fill(hair)
  switch (look.hairStyle) {
    case 'short':
      cap()
      g.roundRect(-5.6, hy - 2.5, 3.4, 5, 1.6).fill(hair)
      break
    case 'long':
      cap()
      g.roundRect(-5.8, hy - 2.5, 4.2, 10.5, 2).fill(hair)
      break
    case 'bun':
      cap()
      g.circle(-3.6, hy - 5, 2.8).fill(hair)
      g.roundRect(-5.6, hy - 2.5, 3.2, 4.5, 1.6).fill(hair)
      break
    case 'curly':
      for (const [cx, cy] of [
        [-4.2, -2.6],
        [-1.8, -4.8],
        [1.4, -5],
        [3.8, -3.6],
        [-5, 0.4],
      ])
        g.circle(cx, hy + cy, 2.5).fill(hair)
      break
    case 'bald':
      g.poly(arcPoints(0, hy, 5.6, Math.PI * 0.85, Math.PI * 1.2)).fill(hair)
      break
  }

  switch (look.accessory) {
    case 'hat':
      g.ellipse(0, hy - 3.5, 9, 2.6).fill(0xd9b36c)
      g.roundRect(-4.6, hy - 9, 9.2, 6, 3).fill(0xe3c07e)
      g.rect(-4.6, hy - 5, 9.2, 1.5).fill(0x8a5f40)
      break
    case 'cap':
      g.poly(arcPoints(0, hy - 0.8, 5.7, Math.PI, Math.PI * 2)).fill(look.shirt === 0x4f6a8a ? 0x2e3a4a : 0xd98b6a)
      g.roundRect(2, hy - 2.2, 6, 2, 1).fill(look.shirt === 0x4f6a8a ? 0x2e3a4a : 0xc0705a)
      break
    case 'glasses':
      g.circle(2.7, hy + 0.6, 1.8).stroke({ width: 0.8, color: PAL.ink })
      g.moveTo(-2, hy + 0.2).lineTo(0.9, hy + 0.4).stroke({ width: 0.7, color: PAL.ink })
      break
    case 'bow':
      g.poly([-5.5, hy - 5, -2.5, hy - 3.5, -5.5, hy - 2]).fill(0xe07a8f)
      g.poly([-0.5, hy - 5, -2.5, hy - 3.5, -0.5, hy - 2]).fill(0xe07a8f)
      break
  }
  return g
}

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps = 14) {
  const pts: number[] = []
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  return pts
}
