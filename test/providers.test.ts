import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLimit } from '@/lib/concurrency'
import { accountExistence } from '@/lib/providers/account-existence'
import { githubEmail } from '@/lib/providers/github-email'
import { gravatar } from '@/lib/providers/gravatar'
import { hibp } from '@/lib/providers/hibp'
import { profileExistence } from '@/lib/providers/profile-existence'
import type { Env, Finding, Provider, Query } from '@/lib/types'

const ctx = (env: Env = {}) => ({ signal: new AbortController().signal, limit: createLimit(5), env })

const run = async (provider: Provider, query: Query, env: Env = {}): Promise<Finding[]> => {
  const out: Finding[] = []
  for await (const f of provider.run(query, ctx(env))) out.push(f)
  return out
}

/** Route a mocked fetch by matching substrings of the requested url. */
const routeFetch = (routes: ReadonlyArray<[string, Response | (() => Response)]>) =>
  vi.fn(async (input: string | URL, _init?: RequestInit) => {
    const url = String(input)
    for (const [needle, response] of routes) {
      if (url.includes(needle)) return typeof response === 'function' ? response() : response.clone()
    }
    return new Response('not matched', { status: 404 })
  })

afterEach(() => vi.restoreAllMocks())

const email: Query = { kind: 'email', value: 'me@example.com' }
const username: Query = { kind: 'username', value: 'octocat' }

describe('gravatar', () => {
  it('parses a 200 profile into a found finding with linked accounts', async () => {
    const body = JSON.stringify({
      entry: [{ displayName: 'Me', preferredUsername: 'me', accounts: [{ shortname: 'github' }] }],
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))

    const [finding] = await run(gravatar, email)
    expect(finding).toMatchObject({ site: 'Gravatar', status: 'found' })
    expect(finding.data).toMatchObject({ name: 'Me', username: 'me', linkedAccounts: ['github'] })
  })

  it('reports not-found on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const [finding] = await run(gravatar, email)
    expect(finding.status).toBe('not-found')
  })

  it('drops a dangerous avatar/account url from the response (XSS guard)', async () => {
    const body = JSON.stringify({
      entry: [
        {
          displayName: 'X',
          thumbnailUrl: 'javascript:alert(1)',
          accounts: [{ url: 'http://127.0.0.1/evil' }],
        },
      ],
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [finding] = await run(gravatar, email)
    expect(finding.data).not.toHaveProperty('avatar')
    expect(finding.data?.linkedAccounts).toEqual([])
  })
})

describe('hibp', () => {
  it('skips itself when no API key is configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await run(hibp, email)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('summarizes breaches on 200', async () => {
    const body = JSON.stringify([{ Title: 'Acme', BreachDate: '2020-01-01', DataClasses: ['Email'] }])
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [finding] = await run(hibp, email, { HIBP_API_KEY: 'k' })
    expect(finding).toMatchObject({ status: 'found' })
    expect(finding.data).toMatchObject({ count: 1 })
  })

  it('reports not-found on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const [finding] = await run(hibp, email, { HIBP_API_KEY: 'k' })
    expect(finding.status).toBe('not-found')
  })
})

describe('githubEmail', () => {
  it('reports found when the search returns a user', async () => {
    const body = JSON.stringify({ items: [{ login: 'octo', html_url: 'https://github.com/octo' }] })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [finding] = await run(githubEmail, email)
    expect(finding).toMatchObject({ status: 'found', url: 'https://github.com/octo' })
  })

  it('reports not-found on an empty result set', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })))
    const [finding] = await run(githubEmail, email)
    expect(finding.status).toBe('not-found')
  })

  it('reports ambiguous when rate limited', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })))
    const [finding] = await run(githubEmail, email)
    expect(finding).toMatchObject({ status: 'ambiguous' })
  })

  it('does not echo a non-https profile url', async () => {
    const body = JSON.stringify({ items: [{ login: 'x', html_url: 'http://github.com/x' }] })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const [finding] = await run(githubEmail, email)
    expect(finding.status).toBe('found')
    expect(finding.url).toBeUndefined()
  })
})

describe('profileExistence', () => {
  it('emits one finding per site and classifies by status', async () => {
    vi.stubGlobal(
      'fetch',
      routeFetch([
        ['api.github.com/users', new Response('{}', { status: 200 })],
        ['codeforces', new Response('', { status: 400 })],
      ]),
    )
    const findings = await run(profileExistence, username)
    expect(findings.length).toBeGreaterThanOrEqual(20)
    expect(findings.find((f) => f.site === 'GitHub')).toMatchObject({ status: 'found' })
    const everyUrlHasUsername = findings.every((f) => f.url?.includes('octocat'))
    expect(everyUrlHasUsername).toBe(true)
  })

  it('turns a per-site network failure into an error finding, not a throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('dns') }))
    const findings = await run(profileExistence, username)
    expect(findings.every((f) => f.status === 'error')).toBe(true)
  })
})

describe('accountExistence', () => {
  it('sends the email in a POST body and classifies the signal', async () => {
    const fetchMock = routeFetch([
      ['accounts.firefox.com', new Response(JSON.stringify({ exists: true }), { status: 200 })],
    ])
    vi.stubGlobal('fetch', fetchMock)

    const findings = await run(accountExistence, email)
    const firefox = findings.find((f) => f.site === 'Firefox Accounts')
    expect(firefox).toMatchObject({ status: 'found' })

    const ffCall = fetchMock.mock.calls.find(([u]) => String(u).includes('firefox'))
    const sentBody = JSON.parse((ffCall?.[1] as RequestInit).body as string)
    expect(sentBody).toEqual({ email: 'me@example.com' })
  })

  it('runs only providers matching the query kind', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    const findings = await run(accountExistence, username)
    expect(findings.every((f) => f.site !== 'Firefox Accounts')).toBe(true)
  })
})
