import type { BenchRun } from '../../../core/bench/run'

export type { BenchRun }

const DB = 'ai-town'
const STORE = 'bench-runs'
/** Small things kept beside the runs, like the shared folder's handle. */
const KEEP = 'bench-keep'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      if (!req.result.objectStoreNames.contains(KEEP)) req.result.createObjectStore(KEEP)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(store, mode).objectStore(store))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Runs kept in this browser; a shared folder or an exported file carries them elsewhere. */
export const history = {
  save: (run: BenchRun) => tx('readwrite', (s) => s.put(run)),
  list: async () => ((await tx('readonly', (s) => s.getAll())) as BenchRun[]).sort((a, b) => b.createdAt - a.createdAt),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
  keep: async <T>(key: string, value: T | null) => {
    if (value === null) await tx('readwrite', (s) => s.delete(key), KEEP)
    else await tx('readwrite', (s) => s.put(value, key), KEEP)
  },
  kept: <T>(key: string) => tx('readonly', (s) => s.get(key), KEEP) as Promise<T | undefined>,
}
