import { describe, expect, it } from 'vitest'
import { createLimit } from '@/lib/concurrency'

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('createLimit', () => {
  it('never runs more than max tasks at once', async () => {
    const limit = createLimit(2)
    let active = 0
    let peak = 0
    const task = async (n: number) => {
      active += 1
      peak = Math.max(peak, active)
      await tick()
      active -= 1
      return n * 2
    }
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => limit(() => task(n))))
    expect(results).toEqual([2, 4, 6, 8, 10])
    expect(peak).toBe(2)
  })

  it('keeps going after a task rejects', async () => {
    const limit = createLimit(1)
    const failed = limit(() => Promise.reject(new Error('boom')))
    const ok = limit(async () => 'ok')
    await expect(failed).rejects.toThrow('boom')
    await expect(ok).resolves.toBe('ok')
  })

  it('rejects a non-positive max', () => {
    expect(() => createLimit(0)).toThrow()
  })
})
