import type { BenchReport } from '../../../core/bench/analysis'
import type { Trial } from '../../../core/bench/runner'

export interface ContenderInfo {
  id: string
  label: string
  kind: string
  model: string
  host: string
  concurrency: number
}

export interface BenchRun {
  id: string
  createdAt: number
  world: string
  seed: number
  repetitions: number
  scenarios: { id: string; text: string; tone: string }[]
  contenders: ContenderInfo[]
  durationMs: number
  cancelled: boolean
  trials: Trial[]
  report: BenchReport
}

const DB = 'ai-town'
const STORE = 'bench-runs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Runs live only in this browser; export them to keep or share. */
export const history = {
  save: (run: BenchRun) => tx('readwrite', (s) => s.put(run)),
  list: async () => ((await tx('readonly', (s) => s.getAll())) as BenchRun[]).sort((a, b) => b.createdAt - a.createdAt),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
}
