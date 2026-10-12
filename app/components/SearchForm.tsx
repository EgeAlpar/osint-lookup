'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import { detectKind } from '@/lib/query'
import type { QueryKind } from '@/lib/types'

type Mode = QueryKind | 'auto'

const row: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' }

const input: CSSProperties = {
  flex: '1 1 240px',
  minWidth: 0,
  padding: '11px 14px',
  fontSize: 16,
  color: 'var(--text)',
  background: 'var(--panel-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
}

const button = (primary: boolean): CSSProperties => ({
  padding: '11px 18px',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: 10,
  border: '1px solid var(--border)',
  color: primary ? '#fff' : 'var(--text)',
  background: primary ? 'var(--accent)' : 'var(--panel-2)',
})

const chip = (active: boolean): CSSProperties => ({
  padding: '5px 12px',
  fontSize: 13,
  cursor: 'pointer',
  borderRadius: 999,
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  color: active ? 'var(--accent)' : 'var(--muted)',
  background: 'transparent',
})

export interface SearchFormProps {
  readonly running: boolean
  readonly onSearch: (kind: QueryKind, value: string) => void
  readonly onCancel: () => void
}

export function SearchForm({ running, onSearch, onCancel }: SearchFormProps) {
  const [mode, setMode] = useState<Mode>('auto')
  const [value, setValue] = useState('')

  const resolvedKind: QueryKind = mode === 'auto' ? detectKind(value) : mode

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (trimmed === '' || running) return
    onSearch(resolvedKind, trimmed)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        {(['auto', 'email', 'username'] as const).map((m) => (
          <button key={m} type="button" style={chip(mode === m)} onClick={() => setMode(m)}>
            {m === 'auto' ? `auto (${resolvedKind})` : m}
          </button>
        ))}
      </div>
      <div style={row}>
        <input
          style={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="email or username"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="email or username"
        />
        {running ? (
          <button type="button" style={button(false)} onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button type="submit" style={button(true)} disabled={value.trim() === ''}>
            Search
          </button>
        )}
      </div>
    </form>
  )
}
