import { describe, expect, it } from 'vitest'
import { mergeAsync } from '@/lib/merge'

async function* delayed<T>(items: readonly T[], ms: number): AsyncIterable<T> {
  for (const item of items) {
    await new Promise((resolve) => setTimeout(resolve, ms))
    yield item
  }
}

const collect = async <T>(source: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = []
  for await (const item of source) out.push(item)
  return out
}

describe('mergeAsync', () => {
  it('yields every item from every source', async () => {
    const sources: AsyncIterable<number | string>[] = [delayed([1, 2], 3), delayed(['a', 'b', 'c'], 1)]
    const out = await collect(mergeAsync(sources))
    expect(out).toHaveLength(5)
    expect(out).toEqual(expect.arrayContaining([1, 2, 'a', 'b', 'c']))
  })

  it('interleaves items as they arrive instead of draining sources in order', async () => {
    const out = await collect(mergeAsync([delayed(['slow'], 30), delayed(['fast'], 1)]))
    expect(out).toEqual(['fast', 'slow'])
  })

  it('finishes immediately for no sources', async () => {
    expect(await collect(mergeAsync([]))).toEqual([])
  })

  it('propagates a source error', async () => {
    async function* failing(): AsyncIterable<number> {
      yield 1
      throw new Error('source failed')
    }
    await expect(collect(mergeAsync([failing()]))).rejects.toThrow('source failed')
  })
})
