import { describe, expect, it } from 'vitest'
import type { Container } from 'pixi.js'
import { Camera } from '../src/render/camera'

/** Just enough of a Pixi container and a DOM element for the camera to move. */
function fakeCamera() {
  const view = {
    x: 0,
    y: 0,
    scale: { x: 1, y: 1, set(s: number) { this.x = s; this.y = s } },
    position: {
      get x() { return view.x },
      set x(v: number) { view.x = v },
      get y() { return view.y },
      set y(v: number) { view.y = v },
      set(x: number, y: number) { view.x = x; view.y = y },
    },
  }
  const el = { addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLElement
  const camera = new Camera(view as unknown as Container, el, { x: -2000, y: -2000, w: 4000, h: 4000 }, () => ({ w: 800, h: 600, right: 0, bottom: 0 }))
  return { camera, view }
}

describe('moving the map from the keyboard', () => {
  it('jumps the whole distance at once with reduced motion', () => {
    const { camera, view } = fakeCamera()
    camera.instant = true
    camera.panBy(90, -45)
    expect([view.x, view.y]).toEqual([90, -45])
  })

  it('glides about the same distance otherwise', () => {
    const { camera, view } = fakeCamera()
    camera.panBy(90, 0)
    for (let i = 0; i < 300; i++) camera.update(1 / 60)
    expect(Math.abs(view.x - 90)).toBeLessThan(9)
    expect(view.y).toBeCloseTo(0, 5)
  })
})
