import { describe, expect, it } from 'vitest'
import { encodeEvent, splitLines } from '@/lib/ndjson'

describe('encodeEvent', () => {
  it('emits one JSON line per event', () => {
    expect(encodeEvent({ type: 'done', count: 3 })).toBe('{"type":"done","count":3}\n')
  })
})

describe('splitLines', () => {
  it('returns complete lines and keeps the partial remainder', () => {
    expect(splitLines('{"a":1}\n{"b":2}\n{"c"')).toEqual({
      lines: ['{"a":1}', '{"b":2}'],
      rest: '{"c"',
    })
  })

  it('skips blank lines', () => {
    expect(splitLines('\n\n{"a":1}\n')).toEqual({ lines: ['{"a":1}'], rest: '' })
  })
})
