import { keyRing, type LlmSettings } from '../providers/llm/config'
import { forgetKeys, hasVault, openKeys, sealKeys, type KeyRing } from '../providers/llm/vault'

/** The passphrase of an open vault, kept only in this tab's memory so every key change is sealed again without asking. */
let passphrase: string | null = null

export const vaultOpen = () => passphrase !== null

/** Starts remembering the keys, encrypted. A vault that exists but is still locked is never overwritten. */
export async function rememberKeys(llm: LlmSettings, pass: string) {
  if (hasVault() && passphrase === null) throw new Error('Ya hay keys guardadas: desbloquéalas primero para no perderlas.')
  await sealKeys(keyRing(llm), pass)
  passphrase = pass
}

export async function unlockKeys(pass: string): Promise<KeyRing> {
  const keys = await openKeys(pass)
  passphrase = pass
  return keys
}

/** Once the vault is open, any change to the keys is sealed again, so it never goes stale. */
export async function resealKeys(llm: LlmSettings) {
  if (passphrase !== null && hasVault()) await sealKeys(keyRing(llm), passphrase)
}

export function forgetRememberedKeys() {
  forgetKeys()
  passphrase = null
}
