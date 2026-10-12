import type { Limit } from './types'

/** Minimal p-limit: run at most `max` tasks concurrently, queue the rest. */
export function createLimit(max: number): Limit {
  if (!Number.isInteger(max) || max < 1) {
    throw new Error(`Concurrency must be a positive integer, got ${max}`)
  }

  let active = 0
  const queue: Array<() => void> = []

  const next = () => {
    const start = queue.shift()
    if (start !== undefined) start()
  }

  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1
            next()
          })
      }
      if (active < max) start()
      else queue.push(start)
    })
}
