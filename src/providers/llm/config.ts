export type ProviderKind = 'mock' | 'anthropic' | 'openai' | 'shellm' | 'custom'
export type Protocol = 'anthropic' | 'openai'

export interface Connection {
  kind: Exclude<ProviderKind, 'mock'>
  protocol: Protocol
  host: string
  apiKey: string
  model: string
  concurrency: number
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
    shellm: { kind: 'shellm', protocol: 'openai', host: 'http://127.0.0.1:6100', apiKey: '', model: 'claude', concurrency: 2 },
    custom: { kind: 'custom', protocol: 'openai', host: 'http://localhost:11434', apiKey: '', model: '', concurrency: 3 },
  },
}

const STORAGE_KEY = 'ai-town:llm-settings'

export function loadSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw) as Partial<LlmSettings>
    return {
      active: saved.active ?? 'mock',
      connections: Object.fromEntries(
        Object.entries(DEFAULT_SETTINGS.connections).map(([k, def]) => [k, { ...def, ...saved.connections?.[k as keyof LlmSettings['connections']] }]),
      ) as LlmSettings['connections'],
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: LlmSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* storage can be unavailable in private windows; settings then last for the session */
  }
}

export function activeLabel(settings: LlmSettings) {
  if (settings.active === 'mock') return 'Simulado'
  const c = settings.connections[settings.active]
  return `${PRESETS[settings.active].label}${c.model ? ` · ${c.model}` : ''}`
}
