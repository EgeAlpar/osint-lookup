import { aggregate, providersFor } from './aggregate'
import { createLimit } from './concurrency'
import { encodeEvent } from './ndjson'
import { allProviders } from './providers'
import type { Env, Query, StreamEvent } from './types'

const CONCURRENCY = 14

/** Run a search and emit NDJSON StreamEvents as a byte stream. */
export function searchStream(query: Query, env: Env, signal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const limit = createLimit(CONCURRENCY)
  const matching = providersFor(allProviders, query)

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(encodeEvent(event)))
      let count = 0
      try {
        send({ type: 'start', query, providers: matching.map((p) => p.id) })
        for await (const finding of aggregate(allProviders, query, { signal, limit, env })) {
          count += 1
          send({ type: 'finding', finding })
        }
        send({ type: 'done', count })
      } catch (error) {
        if (!signal.aborted) {
          send({ type: 'error', message: error instanceof Error ? error.message : 'search failed' })
        }
      } finally {
        controller.close()
      }
    },
  })
}
