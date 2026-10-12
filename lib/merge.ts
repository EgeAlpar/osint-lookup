/**
 * Merge several async iterables into one, yielding items in arrival order.
 * The first source error is rethrown to the consumer.
 */
export async function* mergeAsync<T>(sources: readonly AsyncIterable<T>[]): AsyncIterable<T> {
  const buffer: T[] = []
  let pending = sources.length
  let failure: { readonly error: unknown } | null = null
  let wake: (() => void) | null = null

  const notify = () => {
    const resolve = wake
    wake = null
    if (resolve !== null) resolve()
  }

  const pump = async (source: AsyncIterable<T>) => {
    try {
      for await (const item of source) {
        buffer.push(item)
        notify()
      }
    } catch (error) {
      failure ??= { error }
    } finally {
      pending -= 1
      notify()
    }
  }

  sources.forEach((source) => void pump(source))

  while (true) {
    while (buffer.length > 0) yield buffer.shift() as T
    if (failure !== null) throw (failure as { readonly error: unknown }).error
    if (pending === 0) return
    await new Promise<void>((resolve) => {
      wake = resolve
    })
  }
}
