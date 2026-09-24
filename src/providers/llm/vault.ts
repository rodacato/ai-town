// Keys the user chose to remember, encrypted with a passphrase (PBKDF2 + AES-GCM) so other pages on the same origin only see ciphertext.

const STORAGE_KEY = 'ai-town:key-vault'
/** OWASP's current advice for PBKDF2-SHA256; vaults sealed before it carry their own count. */
const ITERATIONS = 600_000
const LEGACY_ITERATIONS = 310_000

export type KeyRing = Record<string, string>

interface Sealed {
  v: 1
  iter?: number
  salt: string
  iv: string
  data: string
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function hasVault() {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}

export async function sealKeys(keys: KeyRing, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(keys))))
  const sealed: Sealed = { v: 1, iter: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sealed))
}

/** Throws if the passphrase is wrong. */
export async function openKeys(passphrase: string): Promise<KeyRing> {
  const sealed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Sealed | null
  if (!sealed) return {}
  if (sealed.v !== 1) throw new Error('Las keys guardadas son de otra versión; olvídalas y vuelve a ponerlas.')
  const key = await deriveKey(passphrase, unb64(sealed.salt), sealed.iter ?? LEGACY_ITERATIONS)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.data))
    return JSON.parse(new TextDecoder().decode(plain)) as KeyRing
  } catch {
    throw new Error('La frase no es correcta.')
  }
}

export function forgetKeys() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing stored */
  }
}
