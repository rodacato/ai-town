import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, keyRing, loadSettings, saveSettings, withKeys, type LlmSettings } from '../src/providers/llm/config'
import { forgetKeys, hasVault, openKeys, sealKeys } from '../src/providers/llm/vault'
import { memoryStorage } from './helpers'

let storage: ReturnType<typeof memoryStorage>

beforeEach(() => {
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

const withSecret = (): LlmSettings => ({
  active: 'shellm',
  connections: { ...DEFAULT_SETTINGS.connections, shellm: { ...DEFAULT_SETTINGS.connections.shellm, apiKey: 'sk-secret-123', model: 'claude' } },
})

describe('settings storage', () => {
  it('never writes an API key to localStorage', () => {
    saveSettings(withSecret())
    expect(JSON.stringify(storage.dump())).not.toContain('sk-secret-123')
    expect(loadSettings().settings.connections.shellm.model).toBe('claude')
  })

  it('flags keys that older versions left in clear, so the app can scrub them', () => {
    storage.setItem('ai-town:llm-settings', JSON.stringify(withSecret()))
    expect(loadSettings().hadPlaintextKeys).toBe(true)
    saveSettings(loadSettings().settings)
    expect(loadSettings().hadPlaintextKeys).toBe(false)
  })

  it('fills providers added after the settings were saved with their defaults', () => {
    storage.setItem('ai-town:llm-settings', JSON.stringify({ active: 'anthropic', connections: { anthropic: { model: 'mi-modelo' } } }))
    const { settings } = loadSettings()
    expect(settings.connections.anthropic.model).toBe('mi-modelo')
    expect(settings.connections.anthropic.host).toBe(DEFAULT_SETTINGS.connections.anthropic.host)
    expect(settings.connections.custom).toEqual(DEFAULT_SETTINGS.connections.custom)
  })

  it('falls back to defaults when storage holds garbage', () => {
    storage.setItem('ai-town:llm-settings', '{no es json')
    expect(loadSettings().settings).toEqual(DEFAULT_SETTINGS)
  })

  it('moves keys in and out of settings without touching anything else', () => {
    const ring = keyRing(withSecret())
    expect(ring).toEqual({ shellm: 'sk-secret-123' })
    const restored = withKeys(DEFAULT_SETTINGS, ring)
    expect(restored.connections.shellm.apiKey).toBe('sk-secret-123')
    expect(restored.connections.anthropic.apiKey).toBe('')
  })
})

describe('key vault', () => {
  it('stores only ciphertext and opens with the right passphrase', async () => {
    await sealKeys({ shellm: 'sk-secret-123', anthropic: 'sk-ant-456' }, 'frase larga y secreta')
    expect(hasVault()).toBe(true)
    expect(JSON.stringify(storage.dump())).not.toMatch(/sk-secret-123|sk-ant-456/)
    expect(await openKeys('frase larga y secreta')).toEqual({ shellm: 'sk-secret-123', anthropic: 'sk-ant-456' })
  })

  it('refuses the wrong passphrase with a readable message', async () => {
    await sealKeys({ shellm: 'sk-secret-123' }, 'frase correcta')
    await expect(openKeys('otra frase')).rejects.toThrow('La frase no es correcta.')
  })

  it('uses a fresh salt each time, so the same keys never look the same twice', async () => {
    await sealKeys({ shellm: 'x' }, 'frase correcta')
    const first = storage.getItem('ai-town:key-vault')
    await sealKeys({ shellm: 'x' }, 'frase correcta')
    expect(storage.getItem('ai-town:key-vault')).not.toBe(first)
  })

  it('forgets everything on request', async () => {
    await sealKeys({ shellm: 'x' }, 'frase correcta')
    forgetKeys()
    expect(hasVault()).toBe(false)
    expect(await openKeys('frase correcta')).toEqual({})
  })
})
