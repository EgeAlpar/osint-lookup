import { describe, expect, it } from 'vitest'
import { aggregate } from '@/lib/aggregate'
import { createLimit } from '@/lib/concurrency'
import type { Finding, Provider, ProviderContext, Query } from '@/lib/types'

const finding = (provider: string, site: string, status: Finding['status'] = 'found'): Finding => ({
  provider,
  site,
  status,
  checkedAt: '2026-01-01T00:00:00.000Z',
})

const provider = (id: string, kind: Provider['kind'], items: readonly Finding[]): Provider => ({
  id,
  kind,
  async *run() {
    yield* items
  },
})

const ctx = (): ProviderContext => ({
  signal: new AbortController().signal,
  limit: createLimit(4),
  env: {},
})

const collect = async (source: AsyncIterable<Finding>) => {
  const out: Finding[] = []
  for await (const item of source) out.push(item)
  return out
}

const username: Query = { kind: 'username', value: 'octocat' }

describe('aggregate', () => {
  it('only runs providers that match the query kind', async () => {
    const providers = [
      provider('a', 'username', [finding('a', 'A')]),
      provider('b', 'email', [finding('b', 'B')]),
      provider('c', 'both', [finding('c', 'C')]),
    ]
    const out = await collect(aggregate(providers, username, ctx()))
    expect(out.map((f) => f.provider).sort()).toEqual(['a', 'c'])
  })

  it('drops duplicate provider+site findings, keeping the first', async () => {
    const providers = [
      provider('a', 'username', [finding('a', 'GitHub'), finding('a', 'GitHub', 'not-found')]),
    ]
    const out = await collect(aggregate(providers, username, ctx()))
    expect(out).toEqual([finding('a', 'GitHub')])
  })

  it('turns a crashing provider into an error finding without stopping others', async () => {
    const broken: Provider = {
      id: 'broken',
      kind: 'username',
      async *run() {
        if (Date.now() < 0) yield finding('broken', 'never')
        throw new Error('kaput')
      },
    }
    const out = await collect(
      aggregate([broken, provider('ok', 'username', [finding('ok', 'OK')])], username, ctx()),
    )
    expect(out).toHaveLength(2)
    expect(out.find((f) => f.provider === 'broken')).toMatchObject({
      status: 'error',
      site: 'broken',
      note: 'kaput',
    })
  })
})
