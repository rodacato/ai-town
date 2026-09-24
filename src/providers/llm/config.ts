export type ProviderKind = 'mock' | 'anthropic' | 'openai' | 'shellm' | 'custom'
export type Protocol = 'anthropic' | 'openai'

export interface Connection {
  kind: Exclude<ProviderKind, 'mock'>
  protocol: Protocol
  host: string
  apiKey: string
  model: string
  concurrency: number
  /** USD per million tokens, overriding the known list price; used to estimate cost when the host does not report it. */
  priceIn?: number
  priceOut?: number
  /** Use Anthropic's prompt cache (on by default); off only to measure what it saves. */
  promptCache?: boolean
  /** The model those prices were typed in for; they apply to no other, so comparing two models on one host never mixes prices. */
  priceModel?: string
}

export interface LlmSettings {
  active: ProviderKind
  connections: Record<Exclude<ProviderKind, 'mock'>, Connection>
}

export interface ProviderPreset {
  label: string
  description: string
  protocolLocked: boolean
  hostHint: string
  modelHint: string
  envKey: string
}

export const PRESETS: Record<ProviderKind, ProviderPreset> = {
  mock: {
    label: 'Simulado',
    description: 'Reglas locales según rasgos y relaciones. Gratis, al instante y sin conexión.',
    protocolLocked: true,
    hostHint: '',
    modelHint: '',
    envKey: '',
  },
  anthropic: {
    label: 'Claude',
    description: 'API de Anthropic con tu API key.',
    protocolLocked: true,
    hostHint: 'https://api.anthropic.com',
    modelHint: 'claude-opus-5',
    envKey: 'ANTHROPIC_API_KEY',
  },
  openai: {
    label: 'OpenAI',
    description: 'API de OpenAI con tu API key.',
    protocolLocked: true,
    hostHint: 'https://api.openai.com',
    modelHint: 'Elige uno de la lista',
    envKey: 'OPENAI_API_KEY',
  },
  shellm: {
    label: 'SheLLM',
    description: 'Tu suscripción de Claude Code o Codex, servida por SheLLM.',
    protocolLocked: false,
    hostHint: 'http://127.0.0.1:6100',
    modelHint: 'claude, codex, claude-sonnet…',
    envKey: 'SHELLM_KEY',
  },
  custom: {
    label: 'Personalizado',
    description: 'Cualquier API compatible con OpenAI: Ollama, LM Studio, OpenRouter…',
    protocolLocked: false,
    hostHint: 'http://localhost:11434',
    modelHint: 'llama3.2, qwen3…',
    envKey: 'CUSTOM_LLM_KEY',
  },
}

export const DEFAULT_SETTINGS: LlmSettings = {
  active: 'mock',
  connections: {
    anthropic: { kind: 'anthropic', protocol: 'anthropic', host: 'https://api.anthropic.com', apiKey: '', model: 'claude-opus-5', concurrency: 6 },
    openai: { kind: 'openai', protocol: 'openai', host: 'https://api.openai.com', apiKey: '', model: '', concurrency: 6 },
    shellm: { kind: 'shellm', protocol: 'openai', host: 'http://127.0.0.1:6100', apiKey: '', model: 'claude', concurrency: 5 },
    custom: { kind: 'custom', protocol: 'openai', host: 'http://localhost:11434', apiKey: '', model: '', concurrency: 3 },
  },
}

const STORAGE_KEY = 'ai-town:llm-settings'

/** Settings without keys; `hadPlaintextKeys` flags keys saved in clear by older versions, which the caller should scrub. */
export function loadSettings(): { settings: LlmSettings; hadPlaintextKeys: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { settings: DEFAULT_SETTINGS, hadPlaintextKeys: false }
    const saved = JSON.parse(raw) as Partial<LlmSettings>
    const settings: LlmSettings = {
      active: saved.active ?? 'mock',
      connections: Object.fromEntries(
        Object.entries(DEFAULT_SETTINGS.connections).map(([k, def]) => {
          const c = { ...def, ...saved.connections?.[k as keyof LlmSettings['connections']] }
          // Prices saved before they were tied to a model belong to the model chosen then.
          return [k, c.priceIn !== undefined && !c.priceModel ? { ...c, priceModel: c.model } : c]
        }),
      ) as LlmSettings['connections'],
    }
    return { settings, hadPlaintextKeys: Object.values(settings.connections).some((c) => c.apiKey) }
  } catch {
    return { settings: DEFAULT_SETTINGS, hadPlaintextKeys: false }
  }
}

/** Keys are never written here; they live in memory or, if the user opts in, encrypted in the vault. */
export function saveSettings(settings: LlmSettings) {
  const withoutKeys = { ...settings, connections: Object.fromEntries(Object.entries(settings.connections).map(([k, c]) => [k, { ...c, apiKey: '' }])) }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutKeys))
  } catch {
    /* storage can be unavailable in private windows; settings then last for the session */
  }
}

export function keyRing(settings: LlmSettings) {
  return Object.fromEntries(Object.entries(settings.connections).filter(([, c]) => c.apiKey).map(([k, c]) => [k, c.apiKey]))
}

export function withKeys(settings: LlmSettings, keys: Record<string, string>): LlmSettings {
  return {
    ...settings,
    connections: Object.fromEntries(Object.entries(settings.connections).map(([k, c]) => [k, { ...c, apiKey: keys[k] ?? c.apiKey }])) as LlmSettings['connections'],
  }
}

/** The big hosted APIs refuse every request without a key; SheLLM and local servers often need none. */
export const needsKey = (kind: Connection['kind']) => kind === 'anthropic' || kind === 'openai'

/** The chosen model cannot answer: its key is neither typed in nor in the dev server's .env. */
export function missingKey(settings: LlmSettings, envKeys: readonly string[]) {
  if (settings.active === 'mock') return false
  return needsKey(settings.active) && !settings.connections[settings.active].apiKey && !envKeys.includes(settings.active)
}

export function activeLabel(settings: LlmSettings) {
  if (settings.active === 'mock') return 'Simulado'
  const c = settings.connections[settings.active]
  return `${PRESETS[settings.active].label}${c.model ? ` · ${c.model}` : ''}`
}
