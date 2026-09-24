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

/** Height and build per ancestry; `wide` stretches the body sideways for stocky folk. */
const BUILD: Record<string, { scale: number; wide: number }> = {
  human: { scale: 1.1, wide: 1 },
  elf: { scale: 1.14, wide: 0.9 },
  dwarf: { scale: 0.9, wide: 1.25 },
  halfling: { scale: 0.8, wide: 1.02 },
  gnome: { scale: 0.72, wide: 1 },
  halforc: { scale: 1.22, wide: 1.14 },
  tiefling: { scale: 1.1, wide: 1 },
}

export function buildOf(look: Look, age: number) {
  const b = BUILD[look.ancestry ?? 'human'] ?? BUILD.human
  return { scale: b.scale * (age < 14 ? 0.8 : 1), wide: b.wide }
}

export class ResidentSprite {
  readonly view = new Container()
  private stateRing = new Graphics()
  readonly reactionBubble = new Bubble()
  private body: Container
  private legL: Graphics
  private legR: Graphics
  private armL: Graphics
  private armR: Graphics
  private ring = new Graphics()
  private bubble = new Container()
  private dots: Graphics[] = []
  private alpha = 1
  private bubbleOffset = 0
  hovered = false
  selected = false
  /** Distance from the feet to just above the head, in world pixels. */
  readonly headHeight: number

  constructor(
    readonly resident: Resident,
    private overlay: Container,
  ) {
    const { look, age } = resident.profile
    const { scale } = buildOf(look, age)
    this.headHeight = 38 * scale
    this.view.eventMode = 'static'
    this.view.cursor = 'pointer'
    this.view.hitArea = new Rectangle(-11, -this.headHeight, 22, this.headHeight + 4)

    this.ring.ellipse(0, 0, 13, 6.5).stroke({ width: 2.5, color: PAL.accent, alpha: 0.9 })
    this.ring.ellipse(0, 0, 13, 6.5).fill({ color: PAL.accent, alpha: 0.15 })
    this.ring.visible = false
    this.stateRing.ellipse(0, 0, 11, 5.5).stroke({ width: 2.5, color: 0xffffff })
    this.stateRing.ellipse(0, 0, 11, 5.5).fill({ color: 0xffffff, alpha: 0.2 })
    this.stateRing.visible = false
    this.view.addChild(this.stateRing, this.ring)

    const figure = buildFigure(look, age)
    this.body = figure.body
    this.legL = figure.legL
    this.legR = figure.legR
    this.armL = figure.armL
    this.armR = figure.armR
    this.view.addChild(figure.shadow, this.body)

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
    this.overlay.addChild(this.bubble, this.reactionBubble.view)
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
    this.reactionBubble.update(showReaction ? reaction.bubble : { kind: 'none' }, p.x, p.y + this.bubbleOffset + 4, time, dt, zoom)
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

/** A person in the town's style, feet at the origin; the parts animate separately. */
export function buildFigure(look: Look, age: number) {
  const { scale, wide } = buildOf(look, age)
  const shadow = new Graphics().ellipse(0, 0, 7.5 * scale, 3.4 * scale).fill({ color: PAL.shadow, alpha: 0.2 })
  const body = new Container()
  body.scale.set(scale * wide, scale)
  const legL = new Graphics()
  const legR = new Graphics()
  for (const [leg, lx] of [
    [legL, -3.4],
    [legR, 0.6],
  ] as const) {
    leg.roundRect(0, -8, 2.8, 8, 1.2).fill(look.pants)
    leg.roundRect(-0.2, -1.6, 3.4, 1.8, 0.8).fill(shade(look.pants, -0.45))
    leg.x = lx
    body.addChild(leg)
  }
  body.addChild(drawBack(look))
  const armL = new Graphics().roundRect(-1.3, 0, 2.6, 8, 1.3).fill(shade(look.shirt, -0.12))
  armL.position.set(-5.6, -17)
  body.addChild(armL, drawTorso(look))
  const armR = new Graphics().roundRect(-1.3, 0, 2.6, 8, 1.3).fill(look.shirt)
  armR.circle(0, 8, 1.5).fill(look.skin)
  armR.position.set(5.6, -17)
  body.addChild(armR, drawHead(look, age))
  return { shadow, body, legL, legR, armL, armR, scale }
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
  if (look.accessory === 'holy-symbol') {
    g.circle(2, -13.5, 2).fill(0xe3b94f)
    g.circle(2, -13.5, 0.9).fill(0xfff3c4)
  }
  if (look.accessory === 'wooden-sword') {
    g.moveTo(7.5, -7).lineTo(10.5, -21).stroke({ width: 1.8, color: 0xb98b63, cap: 'round' })
    g.moveTo(6, -9.5).lineTo(10, -8.5).stroke({ width: 1.4, color: 0x6b4a33, cap: 'round' })
  }
  return g
}

/** Things carried on the back, drawn behind the torso. */
function drawBack(look: Look) {
  const g = new Graphics()
  switch (look.accessory) {
    case 'longbow':
      g.moveTo(-6, -25).quadraticCurveTo(-12, -14, -6, -2).stroke({ width: 1.6, color: 0x8a5f40, cap: 'round' })
      g.moveTo(-6, -25).lineTo(-6, -2).stroke({ width: 0.6, color: 0xf3eadb })
      break
    case 'lute':
      g.moveTo(-4, -12).lineTo(1, -27).stroke({ width: 1.6, color: 0x6b4a33, cap: 'round' })
      g.ellipse(-5, -10, 4.2, 5.2).fill(0xb98b63)
      g.circle(-5, -11, 1.2).fill(0x4a3526)
      break
    case 'shovel':
      g.moveTo(-7, -2).lineTo(2, -27).stroke({ width: 1.6, color: 0x8a5f40, cap: 'round' })
      g.poly([-9, 0, -5, -5, -3, -3, -6, 3]).fill(0x8d949c)
      break
    case 'axe':
      g.moveTo(-7, -4).lineTo(3, -27).stroke({ width: 1.8, color: 0x8a5f40, cap: 'round' })
      g.poly([1, -28, 7, -30, 7, -21, 2, -23]).fill(0x9aa3ad)
      break
  }
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
  if (age >= 60 && !look.beard) g.moveTo(1.5, hy + 2.8).lineTo(3.4, hy + 2.6).stroke({ width: 0.6, color: shade(look.skin, -0.3) })
  if (look.ancestry === 'gnome') g.circle(5, hy + 1.4, 1.7).fill(shade(look.skin, -0.08))
  if (look.ancestry === 'halforc') {
    g.poly([2.6, hy + 3.2, 3.4, hy + 1.2, 4, hy + 3.2]).fill(0xfbf6ee)
    g.poly([3.9, hy + 3.2, 4.6, hy + 1.6, 5, hy + 3.2]).fill(0xfbf6ee)
  }
  if (look.beard) g.poly([-0.8, hy + 1.4, 5.4, hy + 1, 4.6, hy + 5.5, 1.6, hy + 9, -2.2, hy + 5]).fill(look.beard)

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

  if (look.ancestry === 'elf') g.poly([-3.4, hy - 0.8, -8.2, hy - 5.6, -3, hy + 1.6]).fill(look.skin)
  if (look.ancestry === 'tiefling') {
    g.moveTo(-0.5, hy - 4.6).quadraticCurveTo(-3.5, hy - 10, -6.5, hy - 8).stroke({ width: 2.2, color: 0x3a2a3a, cap: 'round' })
    g.moveTo(2.5, hy - 4.8).quadraticCurveTo(1, hy - 10.5, -1.8, hy - 9.8).stroke({ width: 2, color: 0x3a2a3a, cap: 'round' })
  }

  switch (look.accessory) {
    case 'helmet':
      g.poly(arcPoints(0, hy - 0.4, 6, Math.PI, Math.PI * 2)).fill(0x9aa3ad)
      g.rect(-6, hy - 0.9, 12, 1.8).fill(0x7d8690)
      g.rect(2.8, hy - 1, 1.3, 4.2).fill(0x7d8690)
      g.circle(0, hy - 6.3, 1.2).fill(0xb23a48)
      break
    case 'wizard-hat':
      g.ellipse(0, hy - 3.8, 10, 2.8).fill(0x34467f)
      g.poly([-5, hy - 4.5, 5, hy - 4.5, 2, hy - 13, -4, hy - 21]).fill(0x3f5395)
      g.circle(0.5, hy - 9, 1.1).fill(0xe3b94f)
      break
    case 'straw-hat':
      g.ellipse(0, hy - 3.5, 9.5, 2.6).fill(0xd9b36c)
      g.roundRect(-4.6, hy - 9, 9.2, 6, 3).fill(0xe3c07e)
      g.rect(-4.6, hy - 5, 9.2, 1.5).fill(0xb23a48)
      break
    case 'leaf-crown':
      for (let i = 0; i < 6; i++) g.ellipse(-5 + i * 2, hy - 4.8 + Math.abs(i - 2.5) * 0.6, 1.6, 1).fill(i % 2 ? 0x7fa876 : 0x9cc184)
      g.circle(1, hy - 6, 1).fill(0xf2a7a0)
      break
    case 'tiara':
      g.poly([-3.5, hy - 5, -2.5, hy - 8, -1, hy - 5.8, 0.5, hy - 9, 2, hy - 5.8, 3.5, hy - 8, 4.5, hy - 5]).fill(0xe3b94f)
      g.circle(0.5, hy - 7.2, 0.8).fill(0xb23a48)
      break
    case 'monocle':
      g.circle(2.6, hy + 0.6, 1.9).stroke({ width: 0.8, color: 0xe3b94f })
      g.moveTo(4.2, hy + 1.6).quadraticCurveTo(5, hy + 5, 3, hy + 7).stroke({ width: 0.5, color: 0xe3b94f })
      break
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
