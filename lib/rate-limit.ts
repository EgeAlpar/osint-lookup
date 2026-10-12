interface Window {
  readonly start: number
  readonly count: number
}

export interface RateLimitOptions {
  readonly limit: number
  readonly windowMs: number
  readonly now?: () => number
  /** Expired windows are swept once the map grows past this size. */
  readonly maxKeys?: number
}

export interface RateLimitResult {
  readonly allowed: boolean
  readonly retryAfterMs: number
}

export interface RateLimiter {
  (key: string): RateLimitResult
  size(): number
}

/** Fixed-window, in-memory limiter. Per process: fine for one dev server. */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs, now = Date.now, maxKeys = 10_000 } = options
  const windows = new Map<string, Window>()

  const sweep = (time: number) => {
    for (const [key, w] of windows) {
      if (time - w.start >= windowMs) windows.delete(key)
    }
  }

  const check = (key: string): RateLimitResult => {
    const time = now()
    if (windows.size >= maxKeys) sweep(time)

    const current = windows.get(key)
    if (current === undefined || time - current.start >= windowMs) {
      windows.set(key, { start: time, count: 1 })
      return { allowed: true, retryAfterMs: 0 }
    }

    const retryAfterMs = current.start + windowMs - time
    if (current.count >= limit) return { allowed: false, retryAfterMs }

    windows.set(key, { start: current.start, count: current.count + 1 })
    return { allowed: true, retryAfterMs: 0 }
  }

  return Object.assign(check, { size: () => windows.size })
}
