import { describe, expect, it } from 'vitest'
import { bundleRuns, mergeRuns, readRuns, runFileName } from '../src/core/bench/bundle'
import { executeRun, type BenchRun } from '../src/core/bench/run'
import { createRulesProvider } from '../src/providers/mock'
import { readFolder, removeFromFolder, writeToFolder, type DirHandle } from '../src/app/features/bench/folder'
import { content } from './helpers'

const run = (seed: number): Promise<BenchRun> =>
  executeRun({ content, examples: content.examples.slice(0, 1), seed, repetitions: 1, contenders: [{ contender: { id: 'rules', label: 'Reglas', provider: createRulesProvider(content.vocabulary), concurrency: 8, timeoutMs: 5000 }, info: { id: 'rules', label: 'Reglas', kind: 'rules', model: '', host: '', concurrency: 8 } }] })

/** A folder kept in memory, with the few calls the app makes. */
function fakeFolder(): DirHandle & { files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    name: 'compartida',
    files,
    queryPermission: async () => 'granted',
    requestPermission: async () => 'granted',
    async *values() {
      for (const [name, text] of files) yield { kind: 'file' as const, name, getFile: async () => new File([text], name) }
    },
    getFileHandle: async (name) => ({ createWritable: async () => ({ write: async (data: string) => void files.set(name, data), close: async () => {} }) }),
    removeEntry: async (name) => void files.delete(name),
  }
}

describe('runs that travel', () => {
  it('reads one run or a bundle of many, and refuses anything else', async () => {
    const [a, b] = await Promise.all([run(1), run(2)])
    expect(readRuns(JSON.stringify(a))).toEqual([a])
    expect(readRuns(bundleRuns([a, b]))).toEqual([a, b])
    expect(() => readRuns('{roto')).toThrow(/JSON/)
    expect(() => readRuns(JSON.stringify({ format: 'otra-cosa' }))).toThrow(/AI Town/)
  })

  it('keeps one copy per run, newest first, preferring the one a judge read', async () => {
    const [a, b] = await Promise.all([run(1), run(2)])
    const older = { ...a, createdAt: 1 }
    const judged = { ...older, judge: { judge: 'j', at: 1, perContender: 1, judgments: [], costUsd: 0, costEstimated: false } }
    const merged = mergeRuns([older, b], [judged])
    expect(merged.map((r) => r.id)).toEqual([b.id, a.id])
    expect(merged[1].judge).toBeDefined()
    expect(runFileName(a)).toMatch(/^chismeroble-\d{4}-\d{2}-\d{2}-.+\.json$/)
  })

  it('saves into a shared folder, reads back what others left there, and removes by run', async () => {
    const dir = fakeFolder()
    const [a, b] = await Promise.all([run(1), run(2)])
    await writeToFolder(dir, a)
    dir.files.set('de-la-terminal.json', JSON.stringify(b))
    dir.files.set('notas.json', '{"otra": "cosa"}')
    expect((await readFolder(dir)).map((r) => r.id).sort()).toEqual([a.id, b.id].sort())
    await removeFromFolder(dir, b.id)
    expect([...dir.files.keys()]).toEqual([runFileName(a), 'notas.json'])
  })
})
