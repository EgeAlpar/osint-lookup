import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLimit } from '@/lib/concurrency'
import { profileExistence } from '@/lib/providers/profile-existence'
import type { Finding, Query } from '@/lib/types'

const ctx = () => ({ signal: new AbortController().signal, limit: createLimit(8), env: {} })
const run = async (q: Query): Promise<Finding[]> => {
  const out: Finding[] = []
  for await (const f of profileExistence.run(q, ctx())) out.push(f)
  return out
}
const username: Query = { kind: 'username', value: 'octocat' }

afterEach(() => vi.restoreAllMocks())

describe('runSiteChecks bot-challenge guard', () => {
  it('never reports found when the body is a bot-challenge page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<title>Just a moment...</title> cf_chl_ ...', { status: 200 })),
    )
    const findings = await run(username)
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some((f) => f.status === 'found')).toBe(false)
    const downgraded = findings.find((f) => f.note?.includes('bot protection'))
    expect(downgraded?.status).toBe('ambiguous')
  })

  it('still reports found for a genuine 200 profile body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"login":"octocat"}', { status: 200 })))
    const findings = await run(username)
    expect(findings.some((f) => f.status === 'found')).toBe(true)
  })
})
