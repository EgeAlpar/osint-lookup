import { describe, expect, it } from 'vitest'
import { extractData } from '@/lib/extract'

describe('extractData', () => {
  it('pulls top-level and dotted-path fields', () => {
    const body = JSON.stringify({ name: 'Ege', followers: 42, data: { total_karma: 1200 } })
    expect(extractData(body, { name: 'name', followers: 'followers', karma: 'data.total_karma' })).toEqual({
      name: 'Ege',
      followers: 42,
      karma: 1200,
    })
  })

  it('skips empty, null and object-valued fields', () => {
    const body = JSON.stringify({ name: '', bio: null, obj: { a: 1 }, ok: 'yes' })
    expect(extractData(body, { name: 'name', bio: 'bio', obj: 'obj', ok: 'ok' })).toEqual({ ok: 'yes' })
  })

  it('returns undefined for invalid JSON or no matches', () => {
    expect(extractData('<html>', { a: 'a' })).toBeUndefined()
    expect(extractData('{"x":1}', { a: 'missing.path' })).toBeUndefined()
  })
})
