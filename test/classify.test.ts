import { describe, expect, it } from 'vitest'
import { classify } from '@/lib/classify'

const probe = (status: number, body = '', finalUrl = 'https://site.test/u') => ({
  status,
  body,
  finalUrl,
})

describe('classify', () => {
  it('defaults: 200 is found, 404 and 410 are not-found', () => {
    expect(classify(probe(200), {})).toBe('found')
    expect(classify(probe(404), {})).toBe('not-found')
    expect(classify(probe(410), {})).toBe('not-found')
  })

  it('treats blocking or server errors as ambiguous', () => {
    for (const status of [301, 403, 429, 500, 503]) {
      expect(classify(probe(status), {})).toBe('ambiguous')
    }
  })

  it('honours custom found and not-found statuses', () => {
    const rules = { foundStatus: [200, 204], notFoundStatus: [400] }
    expect(classify(probe(204), rules)).toBe('found')
    expect(classify(probe(400), rules)).toBe('not-found')
    expect(classify(probe(404), rules)).toBe('ambiguous')
  })

  it('marks not-found when the body carries a not-found marker', () => {
    const rules = { notFoundText: ['profile could not be found'] }
    expect(classify(probe(200, '<p>The profile could not be found.</p>'), rules)).toBe('not-found')
    expect(classify(probe(200, '<p>Hello</p>'), rules)).toBe('found')
  })

  it('requires a found marker when foundText is set', () => {
    const rules = { foundText: ['"id"'] }
    expect(classify(probe(200, '{"id":"pg"}'), rules)).toBe('found')
    expect(classify(probe(200, 'null'), rules)).toBe('ambiguous')
  })

  it('lets a not-found marker win over a found marker', () => {
    const rules = { foundText: ['users'], notFoundText: ['"users":[]'] }
    expect(classify(probe(200, '{"users":[]}'), rules)).toBe('not-found')
  })

  it('marks not-found when redirected to a not-found url', () => {
    const rules = { notFoundUrl: '/login' }
    expect(classify(probe(200, '', 'https://site.test/login?next=u'), rules)).toBe('not-found')
  })

  it('can read markers regardless of status when matchAnyStatus is set', () => {
    const rules = { foundText: ['"status":20'], notFoundText: ['"status":1'], matchAnyStatus: true }
    expect(classify(probe(400, '{"status":20}'), rules)).toBe('found')
    expect(classify(probe(400, '{"status":1}'), rules)).toBe('not-found')
    expect(classify(probe(400, '{}'), rules)).toBe('ambiguous')
  })
})
