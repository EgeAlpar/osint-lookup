import { describe, expect, it } from 'vitest'
import { isPrivateHostname, safeHttpsUrl, assertPublicHttps } from '@/lib/url-safety'

describe('isPrivateHostname', () => {
  it('flags loopback, link-local, metadata and private ranges', () => {
    for (const host of [
      'localhost',
      'LOCALHOST',
      'app.localhost',
      '127.0.0.1',
      '127.9.9.9',
      '0.0.0.0',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '::1',
      '[::1]',
      'fe80::1',
      'fc00::1',
    ]) {
      expect(isPrivateHostname(host)).toBe(true)
    }
  })

  it('allows ordinary public hosts', () => {
    for (const host of ['github.com', 'api.github.com', '8.8.8.8', 'x.test', '172.32.0.1']) {
      expect(isPrivateHostname(host)).toBe(false)
    }
  })
})

describe('safeHttpsUrl', () => {
  it('returns https public urls unchanged', () => {
    expect(safeHttpsUrl('https://github.com/octo')).toBe('https://github.com/octo')
  })

  it('rejects dangerous or non-public urls', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,<script>1</script>',
      'http://github.com/x',
      'https://127.0.0.1/x',
      'https://localhost/x',
      'not a url',
      '',
    ]) {
      expect(safeHttpsUrl(bad)).toBeUndefined()
    }
  })

  it('ignores non-string input', () => {
    expect(safeHttpsUrl(undefined)).toBeUndefined()
    expect(safeHttpsUrl(42 as unknown as string)).toBeUndefined()
  })
})

describe('assertPublicHttps', () => {
  it('throws on a private or non-https target', () => {
    expect(() => assertPublicHttps('http://x.test')).toThrow()
    expect(() => assertPublicHttps('https://169.254.169.254/latest')).toThrow()
  })

  it('passes a public https target', () => {
    expect(() => assertPublicHttps('https://api.github.com/users/x')).not.toThrow()
  })
})
