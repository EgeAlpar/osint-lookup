import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLimit } from '@/lib/concurrency'
import { emailProfiles } from '@/lib/providers/email-profiles'
import type { Env, Finding, Query } from '@/lib/types'

const ctx = (env: Env = {}) => ({ signal: new AbortController().signal, limit: createLimit(8), env })

const run = async (query: Query): Promise<Finding[]> => {
  const out: Finding[] = []
  for await (const f of emailProfiles.run(query, ctx())) out.push(f)
  return out
}

afterEach(() => vi.restoreAllMocks())

describe('emailProfiles', () => {
  it('scans profile sites using the email local-part as a candidate handle', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const url = String(input)
        if (url.includes('api.github.com/users')) return new Response('{}', { status: 200 })
        return new Response('', { status: 404 })
      }),
    )
    const findings = await run({ kind: 'email', value: 'egealpar09@gmail.com' })
    expect(findings.length).toBeGreaterThanOrEqual(20)
    const gh = findings.find((f) => f.site === 'GitHub')
    expect(gh).toMatchObject({ provider: 'email-profiles', status: 'found' })
    expect(gh?.url).toContain('egealpar09')
    expect(gh?.note).toContain('egealpar09')
  })

  it('skips entirely when the local part is not a usable handle', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await run({ kind: 'email', value: 'a@x.co' })).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
