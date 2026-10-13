import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLimit } from '@/lib/concurrency'
import { emailCheck } from '@/lib/providers/email-check'
import type { Finding, Query } from '@/lib/types'

const ctx = () => ({ signal: new AbortController().signal, limit: createLimit(4), env: {} })
const run = async (q: Query): Promise<Finding[]> => {
  const out: Finding[] = []
  for await (const f of emailCheck.run(q, ctx())) out.push(f)
  return out
}
const email: Query = { kind: 'email', value: 'me@example.com' }

afterEach(() => vi.restoreAllMocks())

describe('emailCheck (Disify)', () => {
  it('reports a valid non-disposable email as found with domain data', async () => {
    const body = JSON.stringify({ format: true, domain: 'gmail.com', disposable: false, dns: true, whitelist: true })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [f] = await run(email)
    expect(f).toMatchObject({ site: 'Email validity (Disify)', status: 'found' })
    expect(f.data).toMatchObject({ domain: 'gmail.com', disposable: false, knownProvider: true })
  })

  it('flags a disposable address as ambiguous', async () => {
    const body = JSON.stringify({ format: true, domain: 'mailinator.com', disposable: true, dns: true })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [f] = await run(email)
    expect(f.status).toBe('ambiguous')
    expect(f.data).toMatchObject({ disposable: true })
  })

  it('reports an invalid format / no-DNS address as not-found', async () => {
    const body = JSON.stringify({ format: false, dns: false })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [f] = await run(email)
    expect(f.status).toBe('not-found')
  })
})
