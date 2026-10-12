import { describe, expect, it } from 'vitest'
import { fillDeep, fillUrl } from '@/lib/template'

describe('fillUrl', () => {
  it('replaces every {q} with the encoded value', () => {
    expect(fillUrl('https://x.test/{q}?a={q}', 'a b')).toBe('https://x.test/a%20b?a=a%20b')
  })

  it('encodes characters that could change the url structure', () => {
    expect(fillUrl('https://x.test/{q}', '../@evil.test/#')).toBe(
      'https://x.test/..%2F%40evil.test%2F%23',
    )
  })
})

describe('fillDeep', () => {
  it('replaces {q} inside nested strings without touching other values', () => {
    const input = { email: '{q}', nested: { list: ['x-{q}', 3, true] }, n: null }
    const output = fillDeep(input, 'me@x.co')
    expect(output).toEqual({ email: 'me@x.co', nested: { list: ['x-me@x.co', 3, true] }, n: null })
    expect(input.email).toBe('{q}')
  })

  it('keeps quotes inside the value as data once serialized', () => {
    const body = JSON.stringify(fillDeep({ email: '{q}' }, 'a"b'))
    expect(JSON.parse(body)).toEqual({ email: 'a"b' })
  })
})
