import { describe, expect, it } from 'vitest'
import { firstName } from '../src/core/lang'

describe('firstName', () => {
  it('keeps a title with the name it belongs to', () => {
    expect(firstName('Doña Rosalinda de Vallecristal')).toBe('Doña Rosalinda')
    expect(firstName('Sir Aldric Tiesoferro')).toBe('Sir Aldric')
    expect(firstName('Kael Sombraceniza')).toBe('Kael')
    expect(firstName('Pip')).toBe('Pip')
  })
})
