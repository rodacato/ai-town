import { Container, Graphics, Text } from 'pixi.js'
import { PAL } from './palette'

export type BubbleKind = 'none' | 'alert' | 'thinking' | 'speech' | 'badge' | 'megaphone' | 'error'

export interface BubbleState {
  kind: BubbleKind
  emoji?: string
  text?: string
  color?: number
}

const TEXT_RESOLUTION = 4

export class Bubble {
  readonly view = new Container()
  private bg = new Graphics()
  private dots: Graphics[] = []
  private emoji = new Text({ text: '', style: { fontSize: 15, fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif' }, resolution: TEXT_RESOLUTION })
  private label = new Text({
    text: '',
    style: { fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: '500', fill: PAL.ink, wordWrap: true, wordWrapWidth: 150, lineHeight: 15 },
    resolution: TEXT_RESOLUTION,
  })
  private key = ''
  /** Local bounds of a speech or thought bubble, used to keep bubbles from overlapping; null otherwise. */
  box: { x0: number; x1: number; y0: number; y1: number } | null = null
  private pop = 0

  constructor() {
    this.emoji.anchor.set(0.5)
    this.label.anchor.set(0, 0.5)
    this.view.addChild(this.bg, this.emoji, this.label)
    for (let i = 0; i < 3; i++) {
      const d = new Graphics().circle(0, 0, 2).fill(PAL.think)
      this.dots.push(d)
      this.view.addChild(d)
    }
    this.view.visible = false
  }

  update(state: BubbleState, x: number, y: number, time: number, dt: number, zoom = 1) {
    const key = `${state.kind}|${state.emoji}|${state.text}|${state.color}`
    if (key !== this.key) {
      const wasHidden = this.key === '' || this.key.startsWith('none')
      this.key = key
      this.draw(state)
      if (state.kind !== 'none' && (wasHidden || state.kind !== 'badge')) this.pop = 0
    }
    this.view.visible = state.kind !== 'none'
    if (!this.view.visible) {
      this.box = null
      return
    }
    this.pop = Math.min(1, this.pop + dt * 5)
    const s = backOut(this.pop) * Math.min(1.7, Math.max(1, 0.85 / zoom))
    this.view.scale.set(s)
    const bob = state.kind === 'alert' || state.kind === 'megaphone' ? Math.sin(time * 8) * 1.5 : 0
    this.view.position.set(x, y + bob)
    this.view.zIndex = y
    if (state.kind === 'thinking') this.dots.forEach((d, i) => (d.y = -20 + Math.sin(time * 6 - i * 0.9) * 2))
  }

  private draw(state: BubbleState) {
    this.box = null
    const g = this.bg
    g.clear()
    this.emoji.text = ''
    this.label.text = ''
    this.dots.forEach((d) => (d.visible = false))
    switch (state.kind) {
      case 'alert':
        g.circle(0, -14, 11).fill(PAL.accent).stroke({ width: 2, color: 0xffffff })
        g.roundRect(-1.6, -21, 3.2, 9, 1.6).fill(0xffffff)
        g.circle(0, -8.5, 1.8).fill(0xffffff)
        break
      case 'megaphone':
      case 'error':
        g.circle(0, -16, 13).fill(state.kind === 'error' ? 0xe7e2dc : 0xf6e7c4).stroke({ width: 2, color: 0xffffff })
        this.emoji.text = state.kind === 'error' ? '❔' : '📣'
        this.emoji.position.set(0, -16)
        break
      case 'thinking':
        g.circle(-7, -2, 2.5).fill(0xffffff)
        g.circle(-3, -8, 3.5).fill(0xffffff)
        g.ellipse(2, -20, 17, 11).fill(0xffffff).stroke({ width: 1.5, color: PAL.think, alpha: 0.5 })
        this.dots.forEach((d, i) => {
          d.visible = true
          d.x = -5 + i * 7
        })
        this.box = { x0: -15, x1: 19, y0: -31, y1: -9 }
        break
      case 'badge':
        g.circle(0, -13, 11).fill(0xffffff).stroke({ width: 2, color: state.color ?? PAL.accent })
        this.emoji.text = state.emoji ?? ''
        this.emoji.style.fontSize = 12
        this.emoji.position.set(0, -13)
        break
      case 'speech': {
        this.emoji.style.fontSize = 15
        this.emoji.text = state.emoji ?? ''
        this.label.text = state.text ?? ''
        const w = 12 + 20 + this.label.width + 12
        const h = Math.max(30, this.label.height + 14)
        const top = -h - 8
        g.roundRect(-w / 2, top, w, h, 15).fill(0xffffff).stroke({ width: 1.5, color: state.color ?? PAL.accent, alpha: 0.8 })
        g.poly([-5, -9, 5, -9, -2, -1]).fill(0xffffff)
        this.emoji.position.set(-w / 2 + 12 + 9, top + h / 2)
        this.label.position.set(-w / 2 + 12 + 22, top + h / 2)
        this.box = { x0: -w / 2, x1: w / 2, y0: top, y1: -8 }
        return
      }
    }
  }
}

function backOut(t: number) {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}
