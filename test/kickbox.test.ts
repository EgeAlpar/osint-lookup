import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLimit } from '@/lib/concurrency'
import { kickbox } from '@/lib/providers/kickbox'
import type { Finding, Query } from '@/lib/types'

const ctx = () => ({ signal: new AbortController().signal, limit: createLimit(4), env: {} })
const run = async (q: Query): Promise<Finding[]> => {
  const out: Finding[] = []
  for await (const f of kickbox.run(q, ctx())) out.push(f)
  return out
}
const email: Query = { kind: 'email', value: 'me@example.com' }

afterEach(() => vi.restoreAllMocks())

describe('kickbox', () => {
  it('maps a deliverable result to found with quality data', async () => {
    const body = JSON.stringify({ result: 'deliverable', free: true, disposable: false, sendex: 0.8, success: true })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [f] = await run(email)
    expect(f).toMatchObject({ site: 'Email quality (Kickbox)', status: 'found' })
    expect(f.data).toMatchObject({ result: 'deliverable', freeProvider: true, qualityScore: 0.8 })
  })

  it('maps undeliverable to not-found and surfaces a suggestion', async () => {
    const body = JSON.stringify({ result: 'undeliverable', reason: 'rejected_email', did_you_mean: 'me@gmail.com' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [f] = await run(email)
    expect(f.status).toBe('not-found')
    expect(f.data).toMatchObject({ didYouMean: 'me@gmail.com' })
  })
})
