import { readRuns, runFileName } from '../../../core/bench/bundle'
import type { BenchRun } from '../../../core/bench/run'
import { history } from './history'

/** The parts of the File System Access API this uses; Chrome and Edge have it, Firefox and Safari do not. */
interface DirHandle {
  name: string
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string; getFile(): Promise<File> }>
  getFileHandle(name: string, o?: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>
  removeEntry(name: string): Promise<void>
}

const KEY = 'folder'

export const foldersSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window

/** Asks the user for a folder (ideally one synced across machines) and remembers it. */
export async function pickFolder(): Promise<DirHandle> {
  const dir = (await (window as unknown as { showDirectoryPicker(o: { mode: 'readwrite'; id: string }): Promise<DirHandle> }).showDirectoryPicker({ mode: 'readwrite', id: 'ai-town-runs' })) as DirHandle
  await history.keep(KEY, dir)
  return dir
}

export const linkedFolder = () => history.kept<DirHandle>(KEY).catch(() => undefined)
export const forgetFolder = () => history.keep(KEY, null)

/** Whether the browser still lets the app use the folder; asking needs a click from the user. */
export async function folderAccess(dir: DirHandle, ask: boolean): Promise<PermissionState> {
  const now = await dir.queryPermission({ mode: 'readwrite' })
  return now === 'granted' || !ask ? now : dir.requestPermission({ mode: 'readwrite' })
}

/** Every run in the folder, from the app or `npm run bench`; files that are not runs are left alone. */
export async function readFolder(dir: DirHandle): Promise<BenchRun[]> {
  const out: BenchRun[] = []
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      out.push(...readRuns(await (await entry.getFile()).text()))
    } catch {
      // Not a run: other JSON files can share the folder.
    }
  }
  return out
}

export async function writeToFolder(dir: DirHandle, run: BenchRun) {
  const file = await dir.getFileHandle(runFileName(run), { create: true })
  const w = await file.createWritable()
  await w.write(JSON.stringify(run, null, 2))
  await w.close()
}

/** Removes the run's file, whatever it was called (runs from the terminal have their own names). */
export async function removeFromFolder(dir: DirHandle, id: string) {
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      if (readRuns(await (await entry.getFile()).text()).some((r) => r.id === id)) await dir.removeEntry(entry.name)
    } catch {
      // Not a run.
    }
  }
}

export type { DirHandle }
