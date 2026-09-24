import { afterEach, describe, expect, it, vi } from 'vitest'
import { letterKey, lettersMarkdown, loadIdeas, saveIdeas } from '../src/app/ideas'
import { memoryStorage } from './helpers'

afterEach(() => vi.unstubAllGlobals())

describe('the ideas archive', () => {
  const letter = { id: 'a', day: 2, text: 'Quiero un puerto.\nY barcos.', seen: true, via: 'claude-opus-5 (anthropic)', reply: 'Habrá un río.', idea: true }

  it('survives a reload and starts empty when storage is blocked', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(loadIdeas()).toEqual([])
    saveIdeas([letter])
    expect(loadIdeas()).toEqual([letter])
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    })
    expect(loadIdeas()).toEqual([])
    expect(() => saveIdeas([letter])).not.toThrow()
  })

  it('keys letters saved before they had ids', () => {
    expect(letterKey(letter)).toBe('a')
    expect(letterKey({ day: 4, text: 'Una herramienta nueva', seen: false })).toBe('4:Una herramienta nueva')
  })

  it('writes the letters and their replies as Markdown', () => {
    const md = lettersMarkdown([letter], 'Ideas')
    expect(md).toContain('# Ideas')
    expect(md).toContain('## Día 3 · claude-opus-5 (anthropic) · 💡 idea')
    expect(md).toContain('> Quiero un puerto.\n> Y barcos.')
    expect(md).toContain('**Respuesta:** Habrá un río.')
  })
})
