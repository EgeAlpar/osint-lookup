'use client'

import { useCallback, useRef, useState } from 'react'
import { splitLines } from '@/lib/ndjson'
import type { Finding, Query, QueryKind, StreamEvent } from '@/lib/types'

export type SearchState = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

export interface SearchStatus {
  readonly state: SearchState
  readonly findings: readonly Finding[]
  readonly error: string | null
  readonly query: Query | null
  readonly providers: readonly string[]
}

const INITIAL: SearchStatus = {
  state: 'idle',
  findings: [],
  error: null,
  query: null,
  providers: [],
}

export function useSearch() {
  const [status, setStatus] = useState<SearchStatus>(INITIAL)
  const controllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const search = useCallback(async (kind: QueryKind, value: string) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setStatus({ ...INITIAL, state: 'running' })

    const apply = (event: StreamEvent) =>
      setStatus((prev) => {
        switch (event.type) {
          case 'start':
            return { ...prev, query: event.query, providers: event.providers }
          case 'finding':
            return { ...prev, findings: [...prev.findings, event.finding] }
          case 'done':
            return { ...prev, state: 'done' }
          case 'error':
            return { ...prev, state: 'error', error: event.message }
        }
      })

    try {
      const url = `/api/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(value)}`
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok || response.body === null) {
        const detail = await response.json().catch(() => ({}))
        setStatus((prev) => ({
          ...prev,
          state: 'error',
          error: (detail as { error?: string }).error ?? `HTTP ${response.status}`,
        }))
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        buffer += decoder.decode(chunk, { stream: true })
        const { lines, rest } = splitLines(buffer)
        buffer = rest
        for (const line of lines) {
          try {
            apply(JSON.parse(line) as StreamEvent)
          } catch {
            // ignore a malformed line
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus((prev) => ({ ...prev, state: 'cancelled' }))
      } else {
        setStatus((prev) => ({
          ...prev,
          state: 'error',
          error: error instanceof Error ? error.message : 'Network error',
        }))
      }
    }
  }, [])

  return { status, search, cancel }
}
