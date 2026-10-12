'use client'

import type { CSSProperties } from 'react'
import { SearchForm } from './components/SearchForm'
import { ResultList } from './components/ResultList'
import { useSearch } from './useSearch'

const wrap: CSSProperties = {
  maxWidth: 860,
  margin: '0 auto',
  padding: '48px 16px 80px',
}

const statusBar: CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: 'var(--muted)',
  minHeight: 20,
}

const STATE_TEXT: Record<string, string> = {
  idle: '',
  running: 'Searching…',
  done: 'Search complete.',
  cancelled: 'Cancelled.',
  error: '',
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Home() {
  const { status, search, cancel } = useSearch()
  const { state, findings, error, query } = status
  const running = state === 'running'

  return (
    <main style={wrap}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>OSINT Lookup</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
          Enter an email or username. The app queries many public sources in parallel and streams
          results as they arrive. Use it only for your own accounts, with permission, or on
          non-personal targets. Nothing is stored.
        </p>
      </header>

      <SearchForm running={running} onSearch={search} onCancel={cancel} />

      <div style={statusBar}>
        {state === 'error' ? (
          <span style={{ color: 'var(--error)' }}>Error: {error}</span>
        ) : (
          <span>
            {STATE_TEXT[state]}
            {findings.length > 0 ? ` ${findings.length} result(s).` : ''}
            {query ? ` Query: ${query.kind} "${query.value}".` : ''}
          </span>
        )}
        {findings.length > 0 ? (
          <button
            type="button"
            onClick={() => downloadJson(`osint-${query?.value ?? 'results'}.json`, { query, findings })}
            style={{
              marginLeft: 10,
              padding: '2px 10px',
              fontSize: 12,
              cursor: 'pointer',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--accent)',
            }}
          >
            Export JSON
          </button>
        ) : null}
      </div>

      <ResultList findings={findings} />
    </main>
  )
}
