import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchStream } from '@/lib/search'
import { splitLines } from '@/lib/ndjson'
import type { StreamEvent } from '@/lib/types'

const drain = async (stream: ReadableStream<Uint8Array>): Promise<StreamEvent[]> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events: StreamEvent[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const { lines, rest } = splitLines(buffer)
    buffer = rest
    for (const line of lines) events.push(JSON.parse(line) as StreamEvent)
  }
  return events
}

afterEach(() => vi.restoreAllMocks())

describe('searchStream', () => {
  it('emits start, findings and a matching done count as NDJSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))

    const stream = searchStream(
      { kind: 'username', value: 'octocat' },
      {},
      new AbortController().signal,
    )
    const events = await drain(stream)

    const start = events.find((e) => e.type === 'start')
    const done = events.find((e) => e.type === 'done')
    const findings = events.filter((e) => e.type === 'finding')
    expect(start).toBeDefined()
    expect(done).toBeDefined()
    if (done?.type === 'done') expect(done.count).toBe(findings.length)
    expect(findings.length).toBeGreaterThan(0)
  })
})
