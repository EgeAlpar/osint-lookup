import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '@/lib/rate-limit'

describe('createRateLimiter', () => {
  it('allows up to the limit within a window, then blocks', () => {
    let now = 0
    const check = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now })
    expect(check('ip').allowed).toBe(true)
    expect(check('ip').allowed).toBe(true)
    const blocked = check('ip')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBe(1000)
    now = 400
    expect(check('ip').retryAfterMs).toBe(600)
  })

  it('resets after the window passes', () => {
    let now = 0
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now: () => now })
    check('ip')
    now = 1000
    expect(check('ip').allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 })
    expect(check('a').allowed).toBe(true)
    expect(check('b').allowed).toBe(true)
    expect(check('a').allowed).toBe(false)
  })

  it('evicts expired keys so memory stays bounded', () => {
    let now = 0
    const check = createRateLimiter({ limit: 1, windowMs: 10, now: () => now, maxKeys: 2 })
    check('a')
    check('b')
    now = 20
    check('c')
    expect(check.size()).toBe(1)
  })
})
