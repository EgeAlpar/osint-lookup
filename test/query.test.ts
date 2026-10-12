import { describe, expect, it } from 'vitest'
import { detectKind, parseQuery } from '@/lib/query'

describe('detectKind', () => {
  it('treats values containing @ as email', () => {
    expect(detectKind('a@b.co')).toBe('email')
  })

  it('treats everything else as username', () => {
    expect(detectKind('octocat')).toBe('username')
  })
})

describe('parseQuery', () => {
  it('accepts a valid username and trims it', () => {
    expect(parseQuery('username', '  octo.cat_1 ')).toEqual({
      ok: true,
      query: { kind: 'username', value: 'octo.cat_1' },
    })
  })

  it('normalizes a valid email', () => {
    expect(parseQuery('email', 'Me@Example.com')).toEqual({
      ok: true,
      query: { kind: 'email', value: 'me@example.com' },
    })
  })

  it('auto-detects the kind when kind is missing or auto', () => {
    expect(parseQuery(null, 'me@example.com')).toMatchObject({ ok: true, query: { kind: 'email' } })
    expect(parseQuery('auto', 'octocat')).toMatchObject({ ok: true, query: { kind: 'username' } })
  })

  it('rejects an unknown kind', () => {
    expect(parseQuery('phone', 'x')).toEqual({ ok: false, error: 'Unknown query kind' })
  })

  it('rejects empty input', () => {
    expect(parseQuery('username', '   ')).toEqual({ ok: false, error: 'Query is empty' })
    expect(parseQuery('username', null)).toEqual({ ok: false, error: 'Query is empty' })
  })

  it('rejects usernames with unsafe characters', () => {
    for (const bad of ['a/b', 'a b', '../etc', 'a?x=1', 'a#b', 'x'.repeat(65)]) {
      expect(parseQuery('username', bad).ok).toBe(false)
    }
  })

  it('rejects malformed or oversized emails', () => {
    for (const bad of ['no-at', 'a@b', 'a@@b.co', 'a b@c.co', `${'x'.repeat(250)}@b.co`]) {
      expect(parseQuery('email', bad).ok).toBe(false)
    }
  })

  it('rejects emails with control or URL-structural characters in the local part', () => {
    for (const bad of ['a\u0000b@c.co', 'a\u001bb@c.co', 'a/b@c.co', 'a:b@c.co', 'a?b@c.co']) {
      expect(parseQuery('email', bad).ok).toBe(false)
    }
  })

  it('still accepts ordinary emails with common local-part characters', () => {
    for (const good of ['a.b+tag@c.co', 'first_last@sub.domain.io', "o'hara@mail.com"]) {
      expect(parseQuery('email', good).ok).toBe(true)
    }
  })
})
