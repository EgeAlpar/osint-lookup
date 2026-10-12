import { describe, expect, it } from 'vitest'
import { parseAccountSites, parseSites } from '@/lib/manifest'
import sites from '@/lib/data/sites.json'
import accountSites from '@/lib/data/account-sites.json'

describe('parseSites', () => {
  it('accepts the shipped sites manifest', () => {
    const parsed = parseSites(sites)
    expect(parsed.length).toBeGreaterThanOrEqual(20)
    expect(new Set(parsed.map((s) => s.name)).size).toBe(parsed.length)
  })

  it('rejects non-https templates', () => {
    expect(() => parseSites([{ name: 'X', urlTemplate: 'http://x.test/{q}', rules: {} }])).toThrow(
      /https/,
    )
  })

  it('rejects templates without the {q} placeholder', () => {
    expect(() => parseSites([{ name: 'X', urlTemplate: 'https://x.test/', rules: {} }])).toThrow(
      /\{q\}/,
    )
  })

  it('rejects a placeholder inside the host', () => {
    expect(() =>
      parseSites([{ name: 'X', urlTemplate: 'https://{q}.x.test/', rules: {} }]),
    ).toThrow(/host/)
  })

  it('rejects a placeholder or literal in the userinfo (host-spoof guard)', () => {
    expect(() =>
      parseSites([{ name: 'X', urlTemplate: 'https://{q}@x.test/', rules: {} }]),
    ).toThrow(/host|userinfo/)
    expect(() =>
      parseSites([{ name: 'X', urlTemplate: 'https://user@x.test/{q}', rules: {} }]),
    ).toThrow(/userinfo/)
  })

  it('rejects entries missing a name', () => {
    expect(() => parseSites([{ urlTemplate: 'https://x.test/{q}', rules: {} }])).toThrow()
  })
})

describe('parseAccountSites', () => {
  it('accepts the shipped account manifest', () => {
    const parsed = parseAccountSites(accountSites)
    expect(parsed.length).toBeGreaterThanOrEqual(5)
    for (const site of parsed) expect(['GET', 'POST']).toContain(site.method)
  })

  it('rejects unsupported methods', () => {
    expect(() =>
      parseAccountSites([
        { name: 'X', kind: 'email', method: 'DELETE', urlTemplate: 'https://x.test/{q}', rules: {} },
      ]),
    ).toThrow(/method/)
  })

  it('requires {q} in the url or the body', () => {
    expect(() =>
      parseAccountSites([
        { name: 'X', kind: 'email', method: 'POST', urlTemplate: 'https://x.test/', rules: {} },
      ]),
    ).toThrow(/\{q\}/)
  })
})
